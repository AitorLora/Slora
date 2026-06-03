# QA Master Engine — Informe de Auditoría de Lógica de Negocio
**Proyecto:** Slora Nautic — Sistema de gestión de reservas
**Fecha:** 2026-06-02
**Auditor:** QA Master Engine (Staff Engineer Level)
**Archivos analizados:** `reservas/actions.ts`, `flota/actions.ts`, `middleware.ts`, `api/cron/sync-ical/route.ts`, `api/cron/update-states/route.ts`, `NuevaReservaModal.tsx`, `reservas/page.tsx`, `mock-data.ts`

---

## Resumen Ejecutivo

Auditoría completa tras la introducción de la capa **multicanal** (sync iCal SamBoat + Click&Boat, confirmación/rechazo de reservas externas, crons de estado). Se han identificado **8 hallazgos** y **2 decisiones de negocio aceptadas** (hard delete, ventana de cancelación delegada).

> ⚠️ **Nota de regresión:** Tres fixes marcados como resueltos en el informe del 2026-06-01 ya **no están presentes en el código actual**: la validación de estado del activo (E), la comprobación intradía fecha+hora (B) y el soft delete (este último revertido deliberadamente por decisión del cliente). Se re-evalúan abajo.

| Severidad | Nº | Descripción resumida |
|-----------|-----|----------------------|
| 🔴 Crítico | 2 | Inyección de precio vía `tipo` del cliente · Race condition sin constraint en DB |
| 🟡 Medio   | 4 | `duracion` sin whitelist (→ €0) · Modelo día-completo vs ventana horaria incoherente · Estado del activo no validado en servidor · Auth de crons fail-open |
| 🔵 Menor   | 2 | Reserva retroactiva intradía reabierta · Confirmación externa sin re-chequeo temporal |

---

## 🔴 Hallazgos Críticos

---

### 📦 Componente: `src/app/reservas/actions.ts` → `crearReserva()` — Inyección de Precio vía `tipo`

> ✅ **RESUELTO (2026-06-02)** — La query del activo ahora incluye `tipo`. El precio se calcula con `activo.tipo` (real de BD) en lugar de `data.tipo` (cliente), y el INSERT sobrescribe `tipo: activo.tipo`. El vector de pagar tarifa de moto sobre un barco queda cerrado.

* **🔴 Agujero de Lógica / Riesgo:** El campo `data.tipo` (`"moto" | "barco"`) llega del payload del cliente y **es quien decide la rama de tarificación** (línea 126: `if (data.tipo === "moto")`). La query del activo (línea 121) selecciona `sociedad_id, licencia, capacidad` pero **no recupera `activo.tipo`**, así que el servidor nunca verifica que el tipo declarado coincida con el tipo real del activo. El precio de moto (`TARIFAS_MOTO`, 100–250 €) es muy inferior al de barco (300–500 €).

* **🕵️ Escenario de Error (Caso de Uso Roto):** Un cliente intercepta la llamada a la server action y reserva el barco con licencia `BAR-01` (Día completo = 500 €) enviando `tipo: "moto"`, `duracion: "8h"`. El servidor entra en la rama moto y calcula `ingreso_neto = TARIFAS_MOTO["8h"] = 250 €`. Se crea una reserva de un barco de 500 € cobrando 250 €, y además queda registrada con `tipo: "moto"` corrompiendo los informes por tipo de activo.

* **🛠️ Solución de Ingeniería:** Derivar el tipo del activo desde la BD y descartar el del cliente:
  ```typescript
  const { data: activo, error: activoError } = await supabase
    .from("activos")
    .select("sociedad_id, licencia, capacidad, estado, tipo") // añadir tipo (y estado, ver hallazgo E)
    .eq("id", data.activo_id)
    .maybeSingle();
  if (activoError || !activo) throw new Error("Activo no encontrado");

  // Usar SIEMPRE activo.tipo, nunca data.tipo, para tarificar:
  let ingreso_neto: number;
  if (activo.tipo === "moto") {
    ingreso_neto = TARIFAS_MOTO[data.duracion] ?? 0;
  } else { /* ... rama barco ... */ }
  ```
  Y en el INSERT sobrescribir `tipo: activo.tipo` después del `...data`. **Nota:** la ruta externa (`sync-ical` → `confirmarReservaExterna`) sí deriva el tipo del activo en BD (línea 99), por lo que este vector solo afecta a la creación manual.

---

### 📦 Componente: `src/app/reservas/actions.ts` → `crearReserva()` / `confirmarReservaExterna()` — Race Condition sin Constraint en DB

> ⚠️ **RESUELTO EN CÓDIGO — falta 1 acción manual (2026-06-02).** Modelo elegido: **franjas horarias**. (1) `crearReserva` pasa de bloqueo día-completo a solapamiento por hora contra reservas comprometidas (confirmada/en_curso). (2) `crearReserva` y `confirmarReservaExterna` capturan ahora `23P01` (exclusion_violation) además de `23505`. (3) `sync-ical` trata ambos códigos como slot bloqueado. **Acción pendiente:** ejecutar `supabase-constraint-no-solape.sql` en Supabase SQL Editor para crear el constraint de exclusión `reserva_no_solape` (es el backstop atómico que cierra del todo la ventana de carrera).

* **🔴 Agujero de Lógica / Riesgo:** Patrón TOCTOU clásico. `crearReserva()` ejecuta `SELECT solapadas` (líneas 107-116) y luego `INSERT` (línea 137) de forma no atómica. El código ya captura el error `23505` (línea 146), pero **el `UNIQUE INDEX` que lo dispara no existe en Supabase** (sigue siendo acción manual pendiente). Sin él, dos peticiones simultáneas pasan ambas el SELECT e insertan. Lo mismo aplica a `confirmarReservaExterna()`: el guard anti-solapamiento (líneas 183-197) es un SELECT+UPDATE no atómico.

* **🕵️ Escenario de Error (Caso de Uso Roto):** Dos operarios confirman a la vez dos reservas externas pendientes del mismo barco que se solapan en horario. Ambos `confirmarReservaExterna` ejecutan el SELECT de solapadas (ninguna confirmada aún), ambos pasan, ambos hacen UPDATE a `confirmada`. Overbooking real con cliente presentándose dos veces al mismo barco.

* **🛠️ Solución de Ingeniería:** Crear el índice en Supabase SQL Editor (sin migraciones automáticas en este proyecto):
  ```sql
  CREATE UNIQUE INDEX reserva_activo_fecha_activa
    ON reservas (activo_id, fecha)
    WHERE estado IN ('pendiente', 'confirmada', 'en_curso');
  ```
  ⚠️ **Antes de aplicarlo, leer el hallazgo 🟡 “Modelo día-completo vs ventana horaria”** — este índice impone *una reserva por activo y día*, lo cual entra en conflicto con la lógica de ventana horaria de `confirmarReservaExterna`. Hay que elegir un único modelo de disponibilidad y alinear índice + código.

---

## 🟡 Hallazgos Medios

---

### 📦 Componente: `src/app/reservas/actions.ts` → `crearReserva()` — `duracion` sin Validación de Whitelist

> ✅ **RESUELTO (2026-06-02)** — Tras derivar el `tipo` real del activo, se valida `data.duracion` contra `DURACIONES_MOTO`/`DURACIONES_BARCO` y se rechaza si no pertenece al catálogo. Los `?? 0` / `?? 4` quedan como red de seguridad inalcanzable. Cierra el alquiler gratis y el descuadre del contador de mantenimiento.

* **🟡 Agujero de Lógica / Riesgo:** `data.duracion` llega del cliente y se usa como clave directa contra `TARIFAS_MOTO[data.duracion] ?? 0` (línea 127) y `HORAS_CONSUMIDAS[data.duracion] ?? 4` (línea 135). No hay validación de que pertenezca al conjunto válido. Para motos, una duración no reconocida cae en `?? 0` → **alquiler gratis**. Para barcos, cualquier valor distinto de `"Medio día"` se trata como día completo.

* **🕵️ Escenario de Error (Caso de Uso Roto):** Se envía `tipo: "moto"`, `duracion: "10h"` (o cualquier string fuera de catálogo). `TARIFAS_MOTO["10h"]` es `undefined → 0`. Se crea una reserva de moto con `ingreso_neto = 0 €` y `horas_consumidas = 4` (valor por defecto, descuadrando además el contador de mantenimiento).

* **🛠️ Solución de Ingeniería:** Validar contra el catálogo antes de tarificar:
  ```typescript
  const DURACIONES_VALIDAS = activo.tipo === "moto" ? DURACIONES_MOTO : DURACIONES_BARCO;
  if (!DURACIONES_VALIDAS.includes(data.duracion)) {
    throw new Error("Duración no válida para este tipo de activo.");
  }
  ```

---

### 📦 Componente: `crearReserva()` vs `confirmarReservaExterna()` / `sync-ical` — Modelo Día-Completo vs Ventana Horaria Incoherente

> ✅ **RESUELTO (2026-06-02)** — Decisión de negocio: **modelo de franjas horarias**. `crearReserva` ahora usa solapamiento por hora (igual que `confirmarReservaExterna`), y el constraint de DB es de exclusión temporal (`tsrange WITH &&`), no un `UNIQUE(activo_id, fecha)`. Las dos partes del código ya comparten el mismo modelo. **Pendiente UX (no de seguridad):** el modal `NuevaReservaModal` aún calcula disponibilidad por día completo (`reservasOcupadas`), por lo que es *conservador* — oculta un activo parcialmente reservado en vez de ofrecer su franja libre. No causa overbooking; es mejora de conveniencia.

* **🟡 Agujero de Lógica / Riesgo:** Conviven **dos modelos de disponibilidad incompatibles**:
  - `crearReserva()` (línea 107) bloquea **todo el día**: rechaza cualquier reserva activa con el mismo `activo_id` + `fecha`, sin mirar la hora. El `UNIQUE INDEX` propuesto refuerza esto (un activo, un día).
  - `confirmarReservaExterna()` (líneas 180-197) y la UI `estaDisponible()` (page.tsx) usan **solapamiento por ventana horaria**, permitiendo varias reservas del mismo activo el mismo día en franjas distintas (p. ej. moto 09:00-11:00 y 15:00-17:00).
  Con el índice por `(activo_id, fecha)`, dos reservas externas pendientes del mismo activo el mismo día **en horas que no se solapan** harán fallar el segundo INSERT con `23505`. El cron lo interpreta como `bloqueada` (sync-ical línea 137), descartando una reserva legítima.

* **🕵️ Escenario de Error (Caso de Uso Roto):** SamBoat envía dos reservas de la misma moto el 20/06: una a las 09:00 (2h) y otra a las 15:00 (2h). No se solapan. Con el índice activo, la primera entra y la segunda se marca como `bloqueada`, perdiéndose una venta real. Sin el índice, el overbooking del hallazgo crítico sigue abierto. **No se puede tener ambas cosas con la configuración actual.**

* **🛠️ Solución de Ingeniería:** Decidir el modelo de negocio y alinear todo:
  - **Opción A — Un activo por día (más simple):** alinear `confirmarReservaExterna` y `estaDisponible` al modelo día-completo (eliminar la lógica de ventana horaria) y mantener el índice `(activo_id, fecha)`.
  - **Opción B — Franjas horarias (recomendado para motos):** sustituir el índice de día por un constraint de exclusión temporal con `tstzrange` y `EXCLUDE USING gist`, y cambiar el check de `crearReserva` a solapamiento por hora como ya hace `confirmarReservaExterna`.

---

### 📦 Componente: `src/app/reservas/actions.ts` → `crearReserva()` — Estado del Activo no Validado en Servidor

> ✅ **RESUELTO (2026-06-02)** — La query del activo incluye `estado` y se rechaza con error si `activo.estado !== "ACTIVO"` antes del INSERT. El filtrado deja de depender solo del cliente.

* **🟡 Agujero de Lógica / Riesgo:** *(Regresión respecto al informe del 01/06, donde figuraba como resuelto.)* La query del activo (línea 121) **no selecciona `estado`** y no existe comprobación `activo.estado === "ACTIVO"`. El filtrado de activos en MANTENIMIENTO/ALERTA solo ocurre en el cliente (`NuevaReservaModal`, línea 133). Una llamada directa a la server action puede reservar un activo fuera de servicio.

* **🕵️ Escenario de Error (Caso de Uso Roto):** La moto `GTX-03` está en `MANTENIMIENTO` (motor abierto). Una petición directa a `crearReserva` con su `activo_id` crea la reserva sin objeción. El cliente se presenta y la moto no es operativa.

* **🛠️ Solución de Ingeniería:** Añadir `estado` a la query (ya incluido en el snippet del hallazgo crítico de `tipo`) y validar:
  ```typescript
  if (activo.estado !== "ACTIVO") throw new Error("Este activo no está disponible para reservas.");
  ```

---

### 📦 Componente: `api/cron/sync-ical/route.ts` y `api/cron/update-states/route.ts` — Autenticación Fail-Open

* **🟡 Agujero de Lógica / Riesgo:** Ambos crons solo verifican el `Bearer` **si `CRON_SECRET` está definida** (`if (secret) { ... }`, líneas 29-35 / 5-11). Si la variable no está configurada, el bloque entero se omite y el endpoint queda **público**. El middleware deja pasar `/api/cron/*` sin sesión (líneas 40-42). Es un patrón *fail-open*: la ausencia de configuración desactiva la seguridad en lugar de bloquear.

* **🕵️ Escenario de Error (Caso de Uso Roto):** En un despliegue donde `CRON_SECRET` no se haya propagado (preview, staging, error de config), cualquiera puede llamar `GET /api/cron/update-states` y forzar transiciones de estado masivas, o `GET /api/cron/sync-ical` para inyectar reservas desde un .ics manipulado.

* **🛠️ Solución de Ingeniería:** Fail-closed — si falta el secreto, denegar:
  ```typescript
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  ```

---

## 🔵 Hallazgos Menores

---

### 📦 Componente: `src/app/reservas/actions.ts` → `crearReserva()` — Reserva Retroactiva Intradía (reabierta)

> ✅ **RESUELTO (2026-06-02)** — Política elegida: **estricta**. Si la reserva es para hoy, se rechaza cuando la hora de salida (en hora de España) ya ha pasado. Comparación por minutos para evitar desfase UTC. Permite reservas de última hora siempre que la salida sea futura.

* **🔵 Agujero de Lógica / Riesgo:** *(Regresión respecto al informe del 01/06.)* La validación de fecha pasada (líneas 87-90) compara **solo la fecha** (`data.fecha < hoyEspana`), no fecha+hora. Es posible crear hoy una reserva para una hora ya transcurrida del propio día.

* **🕵️ Escenario de Error (Caso de Uso Roto):** Son las 20:00. Se crea una reserva “para hoy a las 09:00”. Pasa el filtro de fecha y el de horario operativo (09:00 está dentro de 09:00-21:00). Queda registrada una actividad en una franja que ya pasó.

* **🛠️ Solución de Ingeniería:** Si el negocio prohíbe registros retroactivos, comparar fecha+hora completas:
  ```typescript
  const fechaHoraReserva = new Date(`${data.fecha}T${data.hora}:00`);
  if (fechaHoraReserva < new Date()) throw new Error("No se pueden crear reservas en fechas u horas pasadas.");
  ```
  Si se permiten regularizaciones del mismo día, documentar la decisión y dejar la validación actual.

---

### 📦 Componente: `src/app/reservas/actions.ts` → `confirmarReservaExterna()` — Sin Re-chequeo Temporal al Confirmar

> ✅ **RESUELTO (2026-06-02)** — Antes del guard de solapamiento se rechaza la confirmación si la fecha/hora de salida (hora de España) ya ha pasado. Misma comparación por minutos que `crearReserva`. *(Pendiente opcional: marcar como `caducada` en un cron las pendientes externas con fecha pasada — mejora, no fallo.)*

* **🔵 Agujero de Lógica / Riesgo:** Al confirmar una reserva externa no se revalida que la fecha/hora sigan siendo futuras ni que estén dentro del horario operativo. El `sync-ical` tampoco valida horario al insertar (inserta tal cual venga del .ics).

* **🕵️ Escenario de Error (Caso de Uso Roto):** Una reserva externa pendiente importada hace días para una fecha que ya pasó (el operario no la atendió a tiempo) puede confirmarse igualmente, generando un registro de actividad futura sobre una fecha pretérita.

* **🛠️ Solución de Ingeniería:** En `confirmarReservaExterna`, antes del UPDATE, rechazar si `new Date(\`${reserva.fecha}T${reserva.hora}:00\`) < new Date()`. Opcionalmente, marcar como `caducada` en el cron las pendientes externas con fecha pasada.

---

## Decisiones de Negocio Aceptadas (no son hallazgos)

| Tema | Estado | Justificación |
|------|--------|---------------|
| **Hard delete en `eliminarReserva()`** | ✅ Aceptado | El cliente exige que lo eliminado no persista en la BD. `delete()` físico (línea 69) es intencional. Se asume la pérdida de histórico financiero como decisión de negocio. |
| **Ventana de cancelación** | ✅ Delegada | Las cancelaciones las gestionan SamBoat/Click&Boat. Slora solo sincroniza el estado tras una cancelación ya procesada externamente. |

---

## Vectores Cubiertos Correctamente ✅

| Vector | Estado | Detalle |
|--------|--------|---------|
| Precio `ingreso_neto` calculado en servidor | ✅ | Recalculado en `crearReserva` y `confirmarReservaExterna`. *(Pero la rama depende de `tipo` del cliente — ver hallazgo crítico.)* |
| `horas_consumidas` calculado en servidor | ✅ | `HORAS_CONSUMIDAS[data.duracion] ?? 4` sobrescribe el valor del cliente (línea 135). |
| Horario de apertura/cierre | ✅ | `crearReserva` valida inicio ≥ 09:00 y fin ≤ 21:00 en servidor (líneas 92-101). |
| Guard anti-overbooking externo | ✅ | `confirmarReservaExterna` verifica solapamiento por ventana antes de confirmar (líneas 180-197). *(No atómico — ver race condition.)* |
| Autenticación en server actions | ✅ | Todas verifican `auth.getUser()` antes de operar. |
| Autorización multi-tenant | ✅ | `perfil.sociedad_id === recurso.sociedad_id` salvo `rol === 'master'`. |
| Existencia del activo validada | ✅ | `.maybeSingle()` + guard de null antes del INSERT. |
| Validación de `fuente` | ✅ | `crearReserva` rechaza fuentes fuera de `FUENTES` (línea 118). |
| Integridad antes de eliminar activo | ✅ | `eliminarActivo` bloquea si hay reservas activas (líneas 62-70). |
| Deduplicación de reservas externas | ✅ | `sync-ical` evita reinserción por `id_externo` (UID iCal). |
| Estados en whitelist | ✅ | `cambiarEstadoReserva` valida contra `ESTADOS_VALIDOS` (línea 16). |
| Confirmación solo de pendientes | ✅ | `confirmarReservaExterna` exige `estado === "pendiente"` (línea 174). |

---

## Plan de Remediación Priorizado

1. 🔴 **Inyección de `tipo`** — derivar `tipo` del activo en BD. *(Cambio de 1 línea de query + rama de precio.)*
2. 🔴 **`UNIQUE INDEX` en Supabase** — pero antes resolver el modelo de disponibilidad (#4).
3. 🟡 **Modelo día vs franja** — decidir Opción A o B y alinear índice + `crearReserva` + `confirmarReservaExterna`.
4. 🟡 **Whitelist de `duracion`** + 🟡 **estado del activo** — ambos en el mismo bloque de `crearReserva`.
5. 🟡 **Crons fail-closed** — 4 líneas, alto impacto en seguridad.
6. 🔵 Intradía y re-chequeo temporal — según política de negocio.

---

*Informe generado por QA Master Engine — Slora Nautic · 2026-06-02*
