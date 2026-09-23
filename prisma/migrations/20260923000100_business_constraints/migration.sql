-- ============================================================================
-- NOVOTIC FLEET — Restricciones de negocio a nivel de base de datos
-- Garantías que no dependen solo de la aplicación.
-- ============================================================================

-- Necesario para restricciones de exclusión con igualdad (vehicle_id) + rangos.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Reservas: fin posterior al inicio y SIN superposición por vehículo.
-- Solo las reservas "vivas" bloquean el horario (canceladas/rechazadas/finalizadas no).
-- Rango semiabierto [inicio, fin): una reserva que termina 12:00 no choca con otra que inicia 12:00.
-- ---------------------------------------------------------------------------
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_time_order_chk" CHECK ("end_at" > "start_at");

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap_excl"
  EXCLUDE USING gist (
    "vehicle_id" WITH =,
    tsrange("start_at", "end_at", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS'));

-- ---------------------------------------------------------------------------
-- Uso de vehículo (viajes)
-- ---------------------------------------------------------------------------
ALTER TABLE "vehicle_usage"
  ADD CONSTRAINT "vehicle_usage_km_order_chk" CHECK ("end_odometer" IS NULL OR "end_odometer" >= "start_odometer"),
  ADD CONSTRAINT "vehicle_usage_distance_chk" CHECK ("distance_km" IS NULL OR "distance_km" >= 0),
  ADD CONSTRAINT "vehicle_usage_fuel_out_chk" CHECK ("fuel_level_out" BETWEEN 0 AND 100),
  ADD CONSTRAINT "vehicle_usage_fuel_in_chk" CHECK ("fuel_level_in" IS NULL OR "fuel_level_in" BETWEEN 0 AND 100),
  ADD CONSTRAINT "vehicle_usage_checkin_complete_chk" CHECK (
    ("checkin_at" IS NULL AND "end_odometer" IS NULL) OR
    ("checkin_at" IS NOT NULL AND "end_odometer" IS NOT NULL)
  );

-- Un vehículo solo puede tener UN viaje abierto a la vez.
CREATE UNIQUE INDEX "vehicle_usage_one_open_per_vehicle"
  ON "vehicle_usage" ("vehicle_id") WHERE "checkin_at" IS NULL;

-- ---------------------------------------------------------------------------
-- Valores no negativos
-- ---------------------------------------------------------------------------
ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_odometer_chk" CHECK ("current_odometer" >= 0),
  ADD CONSTRAINT "vehicles_capacity_chk" CHECK ("passenger_capacity" > 0),
  ADD CONSTRAINT "vehicles_year_chk" CHECK ("year" BETWEEN 1950 AND 2100);

ALTER TABLE "odometer_records"
  ADD CONSTRAINT "odometer_records_value_chk" CHECK ("value" >= 0);

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_chk" CHECK ("amount" >= 0);

ALTER TABLE "maintenance_records"
  ADD CONSTRAINT "maintenance_records_cost_chk" CHECK ("cost" >= 0),
  ADD CONSTRAINT "maintenance_records_odometer_chk" CHECK ("odometer" >= 0);

ALTER TABLE "stored_files"
  ADD CONSTRAINT "stored_files_size_chk" CHECK ("size_bytes" > 0);

-- ---------------------------------------------------------------------------
-- Documentos: vencimiento posterior a emisión
-- ---------------------------------------------------------------------------
ALTER TABLE "vehicle_documents"
  ADD CONSTRAINT "vehicle_documents_dates_chk"
  CHECK ("issue_date" IS NULL OR "expiry_date" IS NULL OR "expiry_date" >= "issue_date");

-- ---------------------------------------------------------------------------
-- Auditoría: registro inmutable. No se puede borrar ni alterar su contenido;
-- solo se permite desvincular user_id (ON DELETE SET NULL).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_logs es de solo inserción';
  END IF;
  IF (NEW.action, NEW.entity, NEW.entity_id, NEW.summary, NEW.metadata::text, NEW.created_at, NEW.ip)
     IS DISTINCT FROM
     (OLD.action, OLD.entity, OLD.entity_id, OLD.summary, OLD.metadata::text, OLD.created_at, OLD.ip) THEN
    RAISE EXCEPTION 'audit_logs es de solo inserción';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
