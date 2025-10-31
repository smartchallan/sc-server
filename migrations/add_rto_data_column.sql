-- Add rto_data column to di_user_vehicle table
ALTER TABLE di_user_vehicle 
ADD COLUMN rto_data BOOLEAN NOT NULL DEFAULT FALSE;

-- Add challan_data column to di_user_vehicle table
ALTER TABLE di_user_vehicle 
ADD COLUMN challan_data BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional: Add comments to describe the columns
ALTER TABLE di_user_vehicle 
MODIFY COLUMN rto_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Indicates if RTO data has been fetched for this vehicle';

ALTER TABLE di_user_vehicle 
MODIFY COLUMN challan_data BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Indicates if challan data has been fetched for this vehicle';