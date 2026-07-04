-- Run this SQL against your database to add geofence fields to companies table
ALTER TABLE companies ADD COLUMN latitude DOUBLE PRECISION;
ALTER TABLE companies ADD COLUMN longitude DOUBLE PRECISION;
ALTER TABLE companies ADD COLUMN geo_radius_meters INTEGER DEFAULT 100;
ALTER TABLE companies ADD COLUMN working_hours VARCHAR(100);
