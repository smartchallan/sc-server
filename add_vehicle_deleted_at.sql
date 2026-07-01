-- Add deleted_at to di_user_vehicle and backfill existing deleted rows.
-- Run once (after / alongside collapse_vehicle_status.sql).
ALTER TABLE di_user_vehicle
ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER updated_at;

UPDATE di_user_vehicle
SET deleted_at = updated_at
WHERE status = 'deleted' AND deleted_at IS NULL;
