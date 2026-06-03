# Mapa de Cambio: Migración a iCal + Vercel Cron

**Estado:** Pendiente de implementación  
**Prioridad:** Media (la app manual es estable; esto es una mejora, no un parche)  
**Responsable:** Aitor  

---

## 1. Resumen de la Nueva Arquitectura

La siguiente versión de Slora incorporará **sincronización pasiva de reservas externas** mediante la lectura periódica de calendarios `.ics` exportados por plataformas de alquiler (Click & Boat, SamBoat, Airbnb Experiences, etc.).

```
Plataforma externa
  └─ exporta calendario .ics (URL pública)
       └─ Vercel Cron Job (cada 10 min)
            └─ GET /api/cron/sync-ical
                 ├─ Parsea eventos del .ics
                 ├─ Compara contra reservas existentes en Supabase
                 └─ Inserta nuevas reservas en estado "pendiente" (ámbar)
                      └─ Trabajador ve la reserva en /reservas
                           └─ Pulsa Confirmar o Rechazar → estado final
```

### Configuración en `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-ical",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

### Endpoint a crear: `/api/cron/sync-ical`

- Autenticado con `CRON_SECRET` en header `Authorization: Bearer <secret>`
- Itera sobre la tabla `activos` buscando aquellos que tengan `ical_url` configurada
- Por cada URL .ics: descarga, parsea con `node-ical` (o similar), extrae eventos `VEVENT`
- Para cada evento nuevo (comprobado por `UID` del evento contra `ical_uid` en la tabla `reservas`): inserta reserva con `estado = "pendiente"` y `fuente = "iCal:<nombre_plataforma>"`
- Protección contra duplicados: `ical_uid` marcado con UNIQUE INDEX en Supabase

---

## 2. Justificación de la Decisión

### Por qué descartamos Webhooks / N8N

| Problema | Detalle |
|----------|---------|
| **Falta de APIs estándar** | Click & Boat no ofrece webhooks outbound documentados ni un contrato de API estable para terceros |
| **Inestabilidad** | Los webhooks dependen de que nuestro servidor esté activo en el momento exacto del envío; una caída de Vercel o un cold start lento puede perder eventos permanentemente |
| **Dependencia de N8N** | Añade un intermediario adicional (N8N como orquestador) con su propio mantenimiento, coste y punto de fallo |
| **Complejidad de autenticación** | Cada plataforma usa un esquema de firma diferente (HMAC, header secret, IP whitelist), lo que aumenta la superficie de ataque y el coste de auditoría |

### Por qué elegimos iCal + Vercel Cron

| Ventaja | Detalle |
|---------|---------|
| **Estándar del sector** | El formato iCalendar (RFC 5545) es universal: lo soportan Click & Boat, SamBoat, Airbnb, Google Calendar, etc. sin negociación previa |
| **Resiliencia** | Si el Cron falla una iteración, la siguiente lo recupera. No se pierden datos: el calendario .ics siempre contiene el historial completo |
| **Coste cero** | Vercel Cron Jobs están incluidos en el plan Hobby/Pro sin coste adicional. No hay infraestructura extra |
| **Rendimiento asíncrono** | La sincronización ocurre en background, fuera del ciclo de respuesta del usuario. Las Server Actions solo leen el resultado; no bloquean |
| **Sin secrets por plataforma** | Solo necesitamos la URL pública del calendario (.ics), que las plataformas generan sin coste y sin acuerdos comerciales especiales |

---

## 3. Flujo Funcional Completo

```
T+0min   Vercel Cron dispara GET /api/cron/sync-ical
T+0min   El endpoint descarga los .ics de cada activo configurado
T+0min   Parsea eventos y detecta UIDs nuevos
T+0min   Inserta reservas nuevas con estado = "pendiente"

T+~1min  El trabajador abre /reservas en el navegador
         Ve la reserva nueva resaltada (pendiente)
         Comprueba disponibilidad real: stand, teléfono, agenda física

T+~2min  Trabajador pulsa "Confirmar" o "Rechazar"
         Server Action actualiza estado en Supabase
         La plataforma externa ya no muestra ese slot (lo bloqueó el .ics)
```

### Regla del 5% humano

El iCal sincroniza el 95% de la disponibilidad automáticamente. El 5% restante (reservas tomadas en el stand, por teléfono o con demora de sincronización) requiere la validación manual del trabajador antes de confirmar. Este flujo de "Confirmar / Rechazar" ya existe en la UI actual y se reutilizará sin cambios.

---

## 4. Cambios Técnicos Requeridos (checklist futuro)

- [ ] Añadir columna `ical_url` (text, nullable) a la tabla `activos` en Supabase
- [ ] Añadir columna `ical_uid` (text, nullable) a la tabla `reservas` + UNIQUE INDEX
- [ ] Crear `/api/cron/sync-ical/route.ts` con autenticación por `CRON_SECRET`
- [ ] Instalar `node-ical` (o `ical.js`) para parseo de .ics
- [ ] Añadir campo `ical_url` al modal de edición de activos en `/flota`
- [ ] Añadir `vercel.json` con la configuración del Cron
- [ ] Configurar variable de entorno `CRON_SECRET` en Vercel Dashboard
- [ ] Probar con calendario de prueba antes de conectar plataformas reales

---

## 5. Variables de Entorno Necesarias

```bash
# Ya existentes
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # necesario para el Cron (escribe sin sesión de usuario)

# Nuevas
CRON_SECRET=...                 # secreto aleatorio para autenticar el endpoint del Cron
```

---

*Documento creado el 2026-06-02. No implementar hasta que la app manual esté validada en producción.*
