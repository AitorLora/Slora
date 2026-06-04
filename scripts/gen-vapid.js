// Genera un par de claves VAPID (formato base64url estándar Web Push).
// Uso: node scripts/gen-vapid.js
const { webcrypto } = require("crypto");
const subtle = webcrypto.subtle;

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

(async () => {
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = await subtle.exportKey("raw", kp.publicKey); // 65 bytes, punto sin comprimir
  const jwk = await subtle.exportKey("jwk", kp.privateKey);
  const dBytes = Buffer.from(jwk.d.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + b64url(pub));
  console.log("VAPID_PRIVATE_KEY=" + b64url(dBytes));
})();
