# ROL
Arquitecto de Software Experto e Ingeniero de Seguridad

# CONTEXTO Y PROBLEMA A RESOLVER
Una única "Empresa de Explotación" central opera una flota unificada de activos náuticos (motos de agua y barcos) propiedad de múltiples "Sociedades" externas (Inversores)[cite: 2]. Los inversores necesitan iniciar sesión en la aplicación para ver únicamente sus activos, comprobar su uso en tiempo real y verificar el ingreso neto generado, garantizando absoluta transparencia y confianza.

# MODELO DE DOMINIO (V3.1 - LEAN / MULTI-TIPO)
- Empresa de Explotación: Centro de control central que gestiona toda la flota de motos y barcos[cite: 2].
- Sociedad (Inversor): Tiene metadatos básicos (`id`, `nombre`) y credenciales (`usuario`, `contraseña`) para el acceso al panel.
- Activo (Moto o Barco): Etiquetado estrictamente con `sociedad_id`[cite: 2]. Registra el tipo (`tipo_activo`: moto/barco), total de horas de motor y su estado[cite: 2].
- Reserva (Booking): Registra la fuente externa[cite: 2], las horas de motor consumidas[cite: 2] y el `ingreso_neto` (el dinero total real que entra).

# CONTROL DE ACCESO BASADO EN ROLES (RBAC)
1. Rol Master (SuperAdmin): Acceso total. Puede ver todas las Sociedades, todos los activos (motos y barcos), todas las reservas y las analíticas globales.
2. Rol Sociedad (Inversor Multi-tenant): Acceso restrictivo. Se autentica mediante `usuario` y `contraseña`. SOLO deben poder ver los activos y los registros de reservas donde `activo.sociedad_id == user.sociedad_id`. Se requiere un aislamiento absoluto de los datos.

# LÓGICA CENTRAL Y TRANSPARENCIA
1. Rotación Auditable (Motos y Barcos):
   - Las reservas asignan automáticamente el activo disponible (del tipo solicitado) con MENOR cantidad de horas de motor[cite: 2].
   - Requerimiento: Registrar una captura (snapshot) de la asignación para demostrar a la Sociedad por qué su activo fue o no fue elegido durante esa ventana de reserva[cite: 2].

2. Control de Mantenimiento Flota (Motos y Barcos):
   - Alertas automáticas cuando cualquier activo (moto o barco) acumule entre 50 y 100 horas desde su último servicio técnico. Al llegar al límite de las 100 horas, el sistema cambia su estado a 'MANTENIMIENTO' y lo bloquea de futuras reservas.

3. Reporte Mensual Simplificado:
   - Agregación mensual automatizada por `sociedad_id`[cite: 2].
   - Métricas a mostrar: Horas de motor iniciales/finales por activo, delta de horas utilizadas e `ingreso_neto` total acumulado durante el mes[cite: 2].

# PROMPT ARQUITECTÓNICO PARA EL AGENTE
Generar:
1. Esquema de Base de Datos SQL: Esquema relacional limpio que incluya la diferenciación de tipo de activo (moto/barco), la estructura de credenciales para RBAC y llaves foráneas (`sociedad_id`).
2. Seguridad a Nivel de Fila (RLS) o Lógica de Alcance de Consultas (Query Scoping): Mostrar cómo el backend garantiza que un usuario tipo "Sociedad" nunca pueda consultar los datos de otra sociedad.
3. Endpoint de Reserva, Rotación y Mantenimiento: Lógica para procesar una reserva aplicando la regla de menos horas según el tipo de activo[cite: 2], validando que no esté bloqueado por mantenimiento (límite 50-100h), registrando el `ingreso_neto` y guardando el log de auditoría.