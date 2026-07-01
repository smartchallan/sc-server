-- Collapse vehicle status to only 'active' and 'deleted'.
-- Run this once against the SmartChallan database (MySQL).
--
-- Step 1: move all currently-inactive vehicles to 'deleted'
--         (must run BEFORE the ALTER, while 'inactive' is still valid).
UPDATE di_user_vehicle
SET status = 'deleted'
WHERE status = 'inactive';

-- Step 2: redefine the column so only 'active' and 'deleted' are allowed.
ALTER TABLE di_user_vehicle
MODIFY COLUMN status ENUM('active', 'deleted') NOT NULL DEFAULT 'active';
