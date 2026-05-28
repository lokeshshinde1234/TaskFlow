-- Add nullable timing fields for existing company and attendance records.
-- Run only if your database does not already have these columns.

ALTER TABLE companies ADD COLUMN start_time VARCHAR(5);
ALTER TABLE companies ADD COLUMN end_time VARCHAR(5);

ALTER TABLE attendance ADD COLUMN company_start_time VARCHAR(5);
ALTER TABLE attendance ADD COLUMN company_end_time VARCHAR(5);
ALTER TABLE attendance ADD COLUMN is_late BOOLEAN DEFAULT 0;
ALTER TABLE attendance ADD COLUMN late_reason TEXT;
ALTER TABLE attendance ADD COLUMN checkout_type VARCHAR(50);
ALTER TABLE attendance ADD COLUMN checkout_reason TEXT;
ALTER TABLE attendance ADD COLUMN auto_checkout_at DATETIME;
