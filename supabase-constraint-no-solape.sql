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

-- 1. Operadores de igualdad sobre tipos escalares (uuid/text) dentro de un índice GiST
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. (Re)crear el constraint de exclusión temporal
ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reserva_no_solape;

ALTER TABLE reservas
  ADD CONSTRAINT reserva_no_solape
  EXCLUDE USING gist (
    activo_id WITH =,
    tsrange(
      (fecha + hora::time),
      (fecha + hora::time + (horas_consumidas * interval '1 hour'))
    ) WITH &&
  )
  WHERE (estado IN ('confirmada', 'en_curso'));

-- ── Notas ────────────────────────────────────────────────────────────────────
-- · El INSERT/UPDATE que viole el solape falla con SQLSTATE 23P01 (exclusion_violation).
--   El código ya lo captura en crearReserva(), confirmarReservaExterna() y sync-ical.
-- · 'hora' se asume TEXT/VARCHAR en formato 'HH:MM' (cast ::time). Si fuese ya tipo
--   time, el cast es inofensivo. 'fecha' es DATE y 'horas_consumidas' INTEGER/NUMERIC.
-- · Si la tabla ya contuviera solapes preexistentes entre confirmadas, el ALTER fallará
--   al validar. En ese caso, resolver/cancelar esos duplicados antes de re-ejecutar.
