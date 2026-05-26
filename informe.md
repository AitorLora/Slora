
# Auditoría — Slora Nautic
> Última revisión: 2026-05-22. Auditoría completa con skill-tester.

---

## 🟠 PENDIENTE 1 — Query de reservas sin límite en `/reservas`

**Archivo:** `src/app/reservas/page.tsx` línea 39

```ts
supabase.from("reservas").select("*").order("created_at", { ascending: false })
```

Carga toda la tabla de reservas sin ningún filtro de fecha ni límite de registros. En reportes se arregló con filtro de año y en flota con `.limit(200)`, pero esta página se quedó sin corregir. Es la página más usada del admin.

**Cómo arreglarlo:** añadir filtro de año actual o límite mínimo:
```ts
.gte("fecha", `${new Date().getFullYear() - 1}-01-01`)
```

---

## 🟠 PENDIENTE 2 — `cambiarEstadoReserva` sin manejo de error en la UI

**Archivo:** `src/app/reservas/page.tsx` líneas 238–240

Cuando el usuario cambia el estado de una reserva desde el dropdown (cualquier estado excepto "cancelada"), la llamada al server action no tiene `try/catch`:

```ts
await cambiarEstadoReserva(r.id, e);
cargar();
```

Si Supabase devuelve un error (sin conexión, token expirado, permiso insuficiente), el dropdown se cierra sin ningún mensaje visible y `cargar()` nunca se ejecuta. El operario puede creer que el cambio se guardó cuando no fue así.

Las acciones de cancelar y eliminar sí están protegidas con ConfirmModal que muestra el error. Esta acción no lo está.

**Cómo arreglarlo:** envolver en `try/catch` y mostrar el error con el banner de error existente o un estado local.

---

## 🟠 PENDIENTE 3 — `marcarRevision` sin manejo de error en la UI

**Archivo:** `src/app/flota/page.tsx` línea 184

Mismo patrón que el pendiente anterior. El botón 🔧 de marcar revisión realizada llama directamente:

```ts
await marcarRevision(a.id); cargar();
```

Sin `try/catch`. Si la operación falla, el usuario ve que el botón se pulsó pero el estado del activo no cambia, sin ninguna explicación.

**Cómo arreglarlo:** envolver en `try/catch` con feedback visual (banner de error o estado local).

---

## ✅ RESUELTO — RLS activo en Supabase para las 3 tablas críticas

RLS habilitado y políticas aplicadas en `activos`, `reservas` y `sociedades`. Los datos de cada sociedad solo son accesibles por usuarios autorizados a nivel de base de datos, independientemente del frontend.

---

## 🟡 A REVISAR 5 — Búsqueda en panel inversor usa `activo_id` en vez de `activo_nombre`

**Archivo:** `src/app/sociedades/[id]/page.tsx` línea 77

```ts
return !q || r.cliente?.toLowerCase().includes(q) || r.activo_id?.toLowerCase().includes(q);
```

La UI ya muestra `activo_nombre ?? activo_id` en las reservas, pero la búsqueda sigue filtrando solo por `activo_id`. Un inversor que busca "Barco con licencia" no encontrará nada.

**Cómo arreglarlo:**
```ts
return !q
  || r.cliente?.toLowerCase().includes(q)
  || r.activo_nombre?.toLowerCase().includes(q)
  || r.activo_id?.toLowerCase().includes(q);
```

---

## 🟡 A REVISAR 6 — Modal de reserva: carga de activos sin manejo de error

**Archivo:** `src/components/reservas/NuevaReservaModal.tsx` líneas 90–101

La carga inicial de activos y sociedades al abrir el modal usa `.then()` sin `.catch()`. Si la query falla, el modal se abre vacío (sin categorías de barco, sin disponibilidad) sin ningún mensaje de error. El usuario no sabe si es un problema real o si simplemente no hay activos.

**Cómo arreglarlo:** añadir `.catch()` o estado de error local que muestre un mensaje dentro del modal.

---

## 🟡 A REVISAR 7 — Reservas del panel inversor sin límite temporal

**Archivo:** `src/app/sociedades/[id]/page.tsx` línea 39

```ts
supabase.from("reservas").select("*").eq("sociedad_id", id).order("created_at", { ascending: false })
```

Carga todas las reservas de la sociedad desde el inicio de los tiempos. Con volumen alto de reservas históricas puede volverse lento.

**Cómo arreglarlo:** añadir filtro de año actual igual que en reportes.

---

## ✅ RESUELTO — `.env.local` correctamente configurado

El archivo se llama `.env.local` y `.gitignore` incluye `.env*`, por lo que las credenciales no se commitearán.

---

## ✅ RESUELTO — Queries con paginación / filtro de año

- `src/app/reportes/page.tsx` — reservas filtradas por año actual (`.gte("fecha", "YYYY-01-01")`)
- `src/app/flota/page.tsx` — activos limitados a 200 registros (`.limit(200)`)

---

## ✅ RESUELTO — "X disponibles hoy" en paso 1 del modal

`src/components/reservas/NuevaReservaModal.tsx` — el texto muestra `"X disponible/s"` sin referencia errónea al día de hoy. La disponibilidad es dinámica según la fecha seleccionada.

---

## ✅ RESUELTO — Precio e ingreso calculados en servidor

`src/app/reservas/actions.ts` — `crearReserva` ignora cualquier precio enviado por el cliente y recalcula `ingreso_neto` en servidor según el activo y la duración. El cliente no puede manipular el precio.

---

## ✅ RESUELTO — Doble booking prevenido en servidor

`src/app/reservas/actions.ts` — `crearReserva` comprueba solapamiento de fechas antes de insertar y lanza error si el activo ya tiene una reserva activa en esa fecha.

---

## ✅ RESUELTO — CSV sin inyección de fórmulas

`src/app/reportes/page.tsx` — la función `exportarCSV` sanitiza todas las celdas eliminando caracteres de fórmula (`=`, `+`, `-`, `@`, tab, CR) antes de generar el archivo.

---

## ✅ RESUELTO — Middleware sin bucle infinito para inversores

`src/middleware.ts` — la ruta `/sociedades/:id` está excluida de `ADMIN_ONLY` para evitar bucle. Los inversores son redirigidos a su panel propio sin riesgo de redirección infinita.

---

## ✅ RESUELTO — Autorización en server actions

Todas las server actions (`cambiarEstadoReserva`, `eliminarReserva`, `crearActivo`, `eliminarActivo`, `marcarRevision`) verifican sesión de usuario y comprueban que el perfil tiene permiso sobre el recurso antes de ejecutar cualquier operación.

---

## ✅ RESUELTO — Nombre del activo en listas de reservas

`src/app/reservas/page.tsx` y `src/app/sociedades/[id]/page.tsx` — muestran `activo_nombre ?? activo_id` con fallback para reservas antiguas sin nombre almacenado.

---

## ✅ RESUELTO — Categorías de barco vacías ocultas en el modal

`src/components/reservas/NuevaReservaModal.tsx` — el paso 2 filtra las categorías de barco para mostrar solo las que tienen activos disponibles en la flota, evitando opciones seleccionables que llevarían a un callejón sin salida.
