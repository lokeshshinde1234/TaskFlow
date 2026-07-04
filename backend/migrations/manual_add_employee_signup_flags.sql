-- Track whether a company-created employee has completed first-time signup.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_registered BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS signup_completed BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE employees
SET is_registered = TRUE,
    signup_completed = TRUE
WHERE id IN (
    SELECT employee_id
    FROM users
    WHERE employee_id IS NOT NULL
      AND role = 'employee'
);

UPDATE employees
SET is_registered = FALSE,
    signup_completed = FALSE
WHERE id IN (
    SELECT employee_id
    FROM users
    WHERE employee_id IS NOT NULL
      AND role = 'employee'
      AND COALESCE(is_email_verified, FALSE) = FALSE
);
