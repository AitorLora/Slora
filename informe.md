# QA Master Engine — Informe de Auditoría de Lógica de Negocio
**Proyecto:** Slora Nautic — Sistema de gestión de reservas  
**Fecha:** 2026-06-01  
**Auditor:** QA Master Engine (Staff Engineer Level)  
**Archivos analizados:** `reservas/actions.ts`, `flota/actions.ts`, `middleware.ts`, `NuevaReservaModal.tsx`, `mock-data.ts`

---

## Resumen Ejecutivo

Se han identificado **7 hallazgos** distribuidos en 3 niveles de severidad:

| Severidad | Nº | Descripción resumida |
|-----------|-----|----------------------|
| 🔴 Crítico | 3 | Race condition overbooking, DELETE físico, estado del activo no validado en servidor |
| 🟡 Medio   | 3 | Hora de cierre no validada, `horas_consumidas` aceptado del cliente, ventana de cancelación ausente |
| 🔵 Menor   | 1 | Reserva hoy con hora pasada permitida |

---

## 🔴 Hallazgos Críticos

---

### 📦 Componente: `src/app/reservas/actions.ts` → `crearReserva()` — Race Condition

> ⚠️ **PARCIALMENTE RESUELTO** — Código actualizado: se captura el error de constraint Postgres 23505 y se lanza un mensaje amigable. Falta acción manual en Supabase: `CREATE UNIQUE INDEX reserva_activo_fecha_activa ON reservas (activo_id, fecha) WHERE estado IN ('pendiente', 'confirmada', 'en_curso');`

* **🔴 Agujero de Lógica / Riesgo:** Condición de carrera clásica (TOCTOU). El flujo ejecuta `SELECT solapadas` y luego `INSERT reserva` como dos operaciones independientes y no atómicas. No existe transacción, `SELECT FOR UPDATE`, constraint único filtrado ni mecanismo de cola entre ambas. Si dos peticiones llegan en el mismo milisegundo, ambas pasan el check de solapamiento y ambas insertan.

* **🕵️ Escenario de Error (Caso de Uso Roto):** Carlos y María reservan la moto MA-123-MA para el mismo día desde dos dispositivos simultáneamente. Ambas peticiones ejecutan el SELECT, ambas obtienen 0 solapamientos, ambas pasan la validación y ambas insertan. Resultado: dos reservas activas para el mismo activo en la misma fecha. Overbooking real.

* **🛠️ Solución de Ingeniería:** Añadir un `UNIQUE INDEX` parcial en Postgres sobre `(activo_id, fecha)` filtrado por estados activos. El INSERT fallará a nivel de constraint si ya existe un solapamiento, eliminando la ventana de carrera:
  ```sql
  CREATE UNIQUE INDEX reserva_activo_fecha_activa
    ON reservas (activo_id, fecha)
    WHERE estado IN ('pendiente', 'confirmada', 'en_curso');
  ```
  En el servidor, capturar el error de constraint Postgres (código `23505`) y lanzar un mensaje amigable. Alternativa más robusta: usar una función RPC en Postgres que ejecute el check + insert dentro de una transacción.

---

### 📦 Componente: `src/app/reservas/actions.ts` → `eliminarReserva()` — DELETE Físico

> ✅ **RESUELTO** — `delete()` reemplazado por `update({ estado: "eliminada" })`. La query de listado en `page.tsx` excluye `.neq("estado", "eliminada")`. Histórico financiero preservado.

* **🔴 Agujero de Lógica / Riesgo:** Se ejecuta `supabase.from("reservas").delete().eq("id", id)` — un DELETE físico. Esto destruye permanentemente el histórico financiero. Cada reserva es un registro contable. Su eliminación hace imposible auditar ingresos pasados, reconstruir el libro de caja, o justificar discrepancias ante la gestoría o Hacienda.

* **🕵️ Escenario de Error (Caso de Uso Roto):** El administrador elimina 15 reservas antiguas de Mayo para "limpiar la vista". Al mes siguiente, el reporte de ingresos de Mayo no cuadra con los cobros reales en banco. No hay forma de reconstruir los datos eliminados. Supabase no tiene papelera de reciclaje por defecto.

* **🛠️ Solución de Ingeniería:** Reemplazar el DELETE por soft delete. Opción A (mínima, sin cambio de schema): en lugar de `delete()`, hacer `update({ estado: 'eliminada' })` y excluir ese estado en todas las queries de listado. Opción B (recomendada): añadir columna `deleted_at TIMESTAMPTZ DEFAULT NULL` en la tabla, hacer `update({ deleted_at: new Date().toISOString() })`, y filtrar con `.is("deleted_at", null)` en todas las lecturas.

---

### 📦 Componente: `src/app/reservas/actions.ts` → `crearReserva()` — Estado del Activo no Validado

> ✅ **RESUELTO** — Query del activo ampliada con `estado`. Se lanza error si `activo.estado !== "ACTIVO"` antes del INSERT.

* **🔴 Agujero de Lógica / Riesgo:** La query de validación del activo selecciona `sociedad_id, licencia, capacidad` pero **no recupera ni comprueba `estado`**. El filtrado por `estado === "ACTIVO"` solo existe en el cliente (`NuevaReservaModal.tsx`). Cualquier petición que omita esa capa cliente puede crear reservas sobre activos en `MANTENIMIENTO` o `ALERTA`.

* **🕵️ Escenario de Error (Caso de Uso Roto):** La moto MA-2423-D está en MANTENIMIENTO después de una avería grave. Un bug en el frontend (o una petición directa a la server action) crea una reserva para esa moto. El cliente se presenta, la moto no está operativa, y se produce un conflicto operativo y reputacional.

* **🛠️ Solución de Ingeniería:**
  ```typescript
  const { data: activo, error: activoError } = await supabase
    .from("activos")
    .select("sociedad_id, licencia, capacidad, estado") // añadir estado
    .eq("id", data.activo_id)
    .maybeSingle();
  if (activoError || !activo) throw new Error("Activo no encontrado");
  if (activo.estado !== "ACTIVO") throw new Error("Este activo no está disponible para reservas.");
  ```

---

## 🟡 Hallazgos Medios

---

### 📦 Componente: `src/app/reservas/actions.ts` → `crearReserva()` — Efecto Cierre no Validado

> ✅ **RESUELTO** — Validación añadida en servidor: calcula `hora_inicio + horas_actividad` y rechaza si supera las 22:00.

* **🟡 Agujero de Lógica / Riesgo:** El servidor no calcula `hora_inicio + duracion_horas` ni verifica que la actividad finalice antes de las 22:00 (hora de cierre del negocio). El TimeInput del cliente limita la hora de inicio pero no la hora de fin, y la restricción del cliente puede omitirse enviando la petición directamente.

* **🕵️ Escenario de Error (Caso de Uso Roto):** Alguien reserva una moto a las 21:00 con duración de 4h. La actividad terminaría a las 01:00. La reserva se crea. Aparece en el sistema como activa durante la madrugada, bloquea el activo para el día siguiente, y los informes de horas no cuadran.

* **🛠️ Solución de Ingeniería:** Antes del INSERT en `crearReserva()`:
  ```typescript
  const HORA_CIERRE = 22; // configurable
  const [horaInicio, minInicio] = data.hora.split(":").map(Number);
  const horasActividad = HORAS_CONSUMIDAS[data.duracion] ?? 4;
  const minutosFinActividad = horaInicio * 60 + minInicio + horasActividad * 60;
  if (minutosFinActividad > HORA_CIERRE * 60) {
    throw new Error(`Esta reserva terminaría después de las ${HORA_CIERRE}:00. Elige una hora de salida anterior.`);
  }
  ```

---

### 📦 Componente: `src/app/reservas/actions.ts` → `crearReserva()` — `horas_consumidas` Aceptado del Cliente

> ✅ **RESUELTO** — `horas_consumidas` ahora se calcula en servidor con `HORAS_CONSUMIDAS[data.duracion] ?? 4` y sobrescribe el valor del cliente en el INSERT.

* **🟡 Agujero de Lógica / Riesgo:** `horas_consumidas` viene del payload del cliente y se inserta directamente vía `...data` sin recalcularse en el servidor. Aunque `ingreso_neto` sí se protege (✅), este campo no. Un valor manipulado (`0` o `9999`) afecta directamente al incremento de horas del activo al completar la reserva, corrompiendo el sistema de mantenimiento.

* **🕵️ Escenario de Error (Caso de Uso Roto):** Un empleado malicioso o un bug envía `horas_consumidas: 0` en una reserva de 8h. Al marcar como completada, el activo no suma horas. La moto llega a su límite real de mantenimiento sin que el sistema lo detecte, poniendo en riesgo la seguridad del equipo y de los clientes.

* **🛠️ Solución de Ingeniería:** Eliminar `horas_consumidas` del tipo de entrada y calcularlo en servidor usando la misma fuente de verdad (`HORAS_CONSUMIDAS`):
  ```typescript
  // En crearReserva(), después de resolver la duración:
  const horas_consumidas = HORAS_CONSUMIDAS[data.duracion] ?? 4;
  
  const { error } = await supabase.from("reservas").insert({
    ...data,
    horas_consumidas,   // ← sobrescribe cualquier valor del cliente
    sociedad_id: activo.sociedad_id,
    estado: "confirmada",
    ingreso_neto,
  });
  ```

---

### 📦 Componente: `src/app/reservas/actions.ts` → `cambiarEstadoReserva()` — Ventana de Cancelación Ausente

> ⛔ **NO APLICA** — Las cancelaciones en Click&Boat y Sandboat las gestiona la plataforma. En Slora el admin solo sincroniza el estado tras una cancelación ya procesada externamente. No corresponde aplicar restricción temporal aquí.

* **🟡 Agujero de Lógica / Riesgo:** No existe validación de ventana de cancelación. El sistema permite cambiar el estado a `cancelada` a cualquier hora, incluso segundos antes del inicio de la actividad. No se comprueba `reserva.fecha + reserva.hora - now() > umbral_minimo`.

* **🕵️ Escenario de Error (Caso de Uso Roto):** Un cliente cancela su reserva a las 09:58 cuando la salida era a las 10:00. El activo queda libre sin tiempo de reacción. Si la política del negocio es "sin cancelaciones con menos de 24h de antelación", el sistema lo permite igualmente. Pérdida de ingreso sin posibilidad de reclamación documentada.

* **🛠️ Solución de Ingeniería:** Al transicionar a `cancelada`, añadir la comprobación temporal. Requiere obtener `fecha` y `hora` de la reserva en la misma query (actualmente ya se hace `.select("sociedad_id, activo_id, horas_consumidas")`; añadir `fecha, hora`):
  ```typescript
  if (estado === "cancelada") {
    const fechaHoraReserva = new Date(`${reserva.fecha}T${reserva.hora}:00`);
    const horasRestantes = (fechaHoraReserva.getTime() - Date.now()) / 3_600_000;
    const HORAS_MIN = 24; // política del negocio
    if (horasRestantes >= 0 && horasRestantes < HORAS_MIN) {
      throw new Error(`No se puede cancelar con menos de ${HORAS_MIN}h de antelación.`);
    }
  }
  ```

---

## 🔵 Hallazgos Menores

---

### 📦 Componente: `src/app/reservas/actions.ts` → `crearReserva()` — Reserva Retroactiva Intradiaria

> ✅ **RESUELTO** — Validación reemplazada por comparación de `fecha+hora` completa contra `new Date()`. Modo estricto activado: no se permiten reservas en horas ya pasadas del día actual.

* **🔵 Agujero de Lógica / Riesgo:** La validación de fecha pasada usa solo comparación de **fecha** (`data.fecha < hoy`), no de **fecha + hora**. Si hoy es `2026-06-01` y son las 20:00, es posible crear una reserva para hoy a las 08:00 — una hora que ya pasó hace 12 horas.

* **🕵️ Escenario de Error (Caso de Uso Roto):** Un empleado crea a las 19:00 una reserva ficticia "para esta mañana a las 09:00" para justificar horas de uso no registradas, o para inflar las métricas del día. El sistema la acepta sin objeción.

* **🛠️ Solución de Ingeniería:** Depende de la política del negocio. Si se quieren prohibir registros retroactivos (modo estricto):
  ```typescript
  const ahora = new Date();
  const fechaHoraReserva = new Date(`${data.fecha}T${data.hora}:00`);
  if (fechaHoraReserva < ahora) {
    throw new Error("No se pueden crear reservas en fechas u horas pasadas.");
  }
  ```
  Si se permiten registros tardíos del mismo día (ej. para regularizar), mantener la validación actual y documentar la decisión.

---

## Vectores Cubiertos Correctamente ✅

| Vector | Estado | Detalle |
|--------|--------|---------|
| Precio calculado en servidor | ✅ | `ingreso_neto` recalculado completamente en `crearReserva()`. Inmune a inyección. |
| Autenticación en todas las actions | ✅ | Todas verifican `supabase.auth.getUser()` antes de operar. |
| Autorización multi-tenant | ✅ | `perfil.sociedad_id === recurso.sociedad_id` verificado salvo para `rol === 'master'`. |
| Existencia del activo validada | ✅ | `.maybeSingle()` + comprobación de error antes del INSERT. |
| Solapamiento de fechas | ✅ | Check de reservas activas para mismo `activo_id` y `fecha`. Filtro de estados correcto. |
| Fecha pasada bloqueada | ✅ | `crearReserva()` rechaza fechas anteriores a hoy. |
| Integridad antes de eliminar activo | ✅ | `eliminarActivo()` comprueba reservas activas existentes antes de borrar. |
| Remediaciones `.single()` | ✅ | Todas las queries usan `.maybeSingle()` con guard de null. Sin crash por filas duplicadas. |
| Estado en whitelist | ✅ | `cambiarEstadoReserva()` valida contra `ESTADOS_VALIDOS`. No se pueden inyectar estados arbitrarios. |

---

*Informe generado por QA Master Engine — Slora Nautic · 2026-06-01*
Soft delete (las eliminadas no desaparecen de la DB, solo se ocultan) , lo que se elimine que se elimine no quiero que persista en la bd , Race condition con constraint de DB pendiente (UNIQUE INDEX manual en Supabase) , 