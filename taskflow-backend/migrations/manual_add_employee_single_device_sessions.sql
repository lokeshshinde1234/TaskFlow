-- Add employee single-device session metadata.
-- Run only if your database does not already have these columns.

ALTER TABLE active_sessions ADD COLUMN employee_id INTEGER;
ALTER TABLE active_sessions ADD COLUMN session_token VARCHAR(64);
ALTER TABLE active_sessions ADD COLUMN device_info VARCHAR(255);
ALTER TABLE active_sessions ADD COLUMN browser_info VARCHAR(500);
ALTER TABLE active_sessions ADD COLUMN ip_address VARCHAR(100);
ALTER TABLE active_sessions ADD COLUMN login_time DATETIME;
ALTER TABLE active_sessions ADD COLUMN last_active_time DATETIME;
ALTER TABLE active_sessions ADD COLUMN is_active BOOLEAN DEFAULT 1;
