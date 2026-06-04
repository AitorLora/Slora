// ─────────────────────────────────────────────────────────────────────────────
// Web Push sin dependencias — compatible con Cloudflare Workers (Web Crypto API).
//
// Implementa:
//  · VAPID (RFC 8292) — firma ES256 del JWT de autenticación.
//  · Cifrado de payload aes128gcm (RFC 8188 + RFC 8291).
//
// Funciona en cualquier runtime con `crypto.subtle`, `fetch`, `atob`/`btoa`.
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabase/admin";

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// ── base64url helpers ────────────────────────────────────────────────────────
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(b: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

// ── HKDF (Extract + Expand en una sola operación, como hace Web Crypto) ───────
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

// ── VAPID: JWT firmado ES256 ──────────────────────────────────────────────────
async function importVapidKey(privB64: string, pubB64: string): Promise<CryptoKey> {
  const d = b64urlToBytes(privB64);
  const pub = b64urlToBytes(pubB64); // 0x04 || x(32) || y(32)
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: bytesToB64url(d),
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function vapidJwt(audience: string, subject: string, privB64: string, pubB64: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  };
  const signingInput = `${bytesToB64url(utf8(JSON.stringify(header)))}.${bytesToB64url(utf8(JSON.stringify(payload)))}`;
  const key = await importVapidKey(privB64, pubB64);
  // Web Crypto ECDSA devuelve r||s crudo (64 bytes) = formato JOSE ES256.
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(signingInput));
  return `${signingInput}.${bytesToB64url(new Uint8Array(sig))}`;
}

// ── Cifrado del payload (aes128gcm, un solo record) ──────────────────────────
async function encryptPayload(plaintext: Uint8Array, p256dh: string, authSecretB64: string): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(p256dh); // 65 bytes
  const authSecret = b64urlToBytes(authSecretB64); // 16 bytes

  // Par ECDH efímero del servidor (uno nuevo por mensaje).
  const asKeyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  )) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey)); // 65 bytes

  const uaKey = await crypto.subtle.importKey("raw", uaPublic as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeyPair.privateKey, 256)
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // RFC 8291 §3.4
  const keyInfo = concat(utf8("WebPush: info"), new Uint8Array([0]), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const cek = await hkdf(salt, ikm, concat(utf8("Content-Encoding: aes128gcm"), new Uint8Array([0])), 16);
  const nonce = await hkdf(salt, ikm, concat(utf8("Content-Encoding: nonce"), new Uint8Array([0])), 12);

  // Record = plaintext || 0x02 (delimitador de último record).
  const record = concat(plaintext, new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, record as BufferSource)
  );

  // Cabecera RFC 8188: salt(16) || rs(4, uint32 BE) || idlen(1) || keyid(asPublic, 65).
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false); // record size
  header[20] = 65;
  header.set(asPublic, 21);

  return concat(header, ciphertext);
}

// ── Envío a un endpoint ──────────────────────────────────────────────────────
async function sendOne(sub: PushSubscriptionRecord, payload: PushPayload): Promise<{ ok: boolean; gone: boolean }> {
  const priv = process.env.VAPID_PRIVATE_KEY;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@slora.app";
  if (!priv || !pub) throw new Error("VAPID keys no configuradas");

  const audience = new URL(sub.endpoint).origin;
  const jwt = await vapidJwt(audience, subject, priv, pub);
  const body = await encryptPayload(utf8(JSON.stringify(payload)), sub.p256dh, sub.auth);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${pub}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: body as BodyInit,
  });

  // 404/410 → la suscripción ya no existe, hay que borrarla.
  return { ok: res.ok, gone: res.status === 404 || res.status === 410 };
}

// ── API pública: enviar a TODOS los dispositivos suscritos ───────────────────
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const supabase = createAdminClient();
  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const { ok, gone } = await sendOne(sub as PushSubscriptionRecord, payload);
        if (ok) sent++;
        else {
          failed++;
          if (gone) expired.push(sub.endpoint);
        }
      } catch {
        failed++;
      }
    })
  );

  // Limpieza de suscripciones muertas.
  if (expired.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
  }

  return { sent, failed };
}
