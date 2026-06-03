-- ─────────────────────────────────────────────────────────────────────────────
-- Slora Nautic — Constraint anti-overbooking (modelo de FRANJAS HORARIAS)
-- Cierra la race condition (hallazgo #2 del informe QA Master, 2026-06-02).
--
-- Ejecutar UNA vez en Supabase → SQL Editor. No hay migraciones automáticas
-- en este proyecto. Es idempotente: puede re-ejecutarse sin romper nada.
--
-- Modelo elegido: un mismo activo puede tener VARIAS reservas el mismo día en
-- franjas que NO se solapan. El constraint impide solo el solapamiento real de
-- horario entre reservas COMPROMETIDAS (confirmada / en_curso). Las 'pendiente'
-- quedan fuera a propósito: son solicitudes que el operario resuelve en /reservas.
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. Eliminar el índice DÍA-COMPLETO heredado del plan de QA anterior.
--    `reserva_activo_fecha_activa` impone UNA reserva por (activo_id, fecha) sin mirar la hora.
--    Es incompatible con el modelo de franjas: bloquea cualquier 2ª reserva del mismo activo el
--    mismo día aunque los horarios NO se pisen (p. ej. mañana 09:00-13:00 + tarde 14:00-18:00),
--    devolviendo 23505. Hay que eliminarlo para que las franjas funcionen.
DROP INDEX IF EXISTS reserva_activo_fecha_activa;

-- 1. Operadores de igualdad sobre tipos escalares (uuid/text) dentro de un índice GiST
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Quitar el constraint si existía (para poder re-ejecutar)
ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reserva_no_solape;

-- 3. Función IMMUTABLE que calcula la franja [salida, salida+duración).
--    Postgres exige que las expresiones de un índice/constraint EXCLUDE sean IMMUTABLE;
--    el cálculo inline (fecha + hora + interval) no se marca como tal y da error 42P17.
--    Envolverlo en esta función resuelve el problema.
CREATE OR REPLACE FUNCTION reserva_rango(p_fecha date, p_hora text, p_horas double precision)
RETURNS tsrange
LANGUAGE sql IMMUTABLE AS $$
  SELECT tsrange(
    (p_fecha + p_hora::time),
    (p_fecha + p_hora::time) + (p_horas * interval '1 hour')
  );
$$;

-- 4. Crear el constraint de exclusión temporal usando la función
ALTER TABLE reservas
  ADD CONSTRAINT reserva_no_solape
  EXCLUDE USING gist (
    activo_id WITH =,
    reserva_rango(fecha, hora, horas_consumidas) WITH &&
  )
  WHERE (estado IN ('confirmada', 'en_curso'));

-- ── Notas ────────────────────────────────────────────────────────────────────
-- · El INSERT/UPDATE que viole el solape falla con SQLSTATE 23P01 (exclusion_violation).
--   El código ya lo captura en crearReserva(), confirmarReservaExterna() y sync-ical.
-- · 'hora' se asume TEXT/VARCHAR en formato 'HH:MM' (cast ::time). Si fuese ya tipo
--   time, el cast es inofensivo. 'fecha' es DATE y 'horas_consumidas' INTEGER/NUMERIC.
-- · Si la tabla ya contuviera solapes preexistentes entre confirmadas, el ALTER fallará
--   al validar. En ese caso, resolver/cancelar esos duplicados antes de re-ejecutar.
