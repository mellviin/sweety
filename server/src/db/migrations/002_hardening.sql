ALTER TABLE users
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN password_hash SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE readings
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN reading_date SET NOT NULL,
  ALTER COLUMN slot SET NOT NULL,
  ALTER COLUMN value SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'readings'::regclass
      AND conname = 'readings_slot_check'
  ) THEN
    ALTER TABLE readings
      ADD CONSTRAINT readings_slot_check
      CHECK (slot IN (
        'MORNING_FASTING',
        'AFTER_BREAKFAST',
        'AFTER_LUNCH',
        'AFTER_DINNER'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'readings'::regclass
      AND conname = 'readings_value_check'
  ) THEN
    ALTER TABLE readings
      ADD CONSTRAINT readings_value_check CHECK (value BETWEEN 40 AND 600);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'readings'::regclass
      AND conname = 'readings_user_id_reading_date_slot_key'
  ) THEN
    ALTER TABLE readings
      ADD CONSTRAINT readings_user_id_reading_date_slot_key
      UNIQUE (user_id, reading_date, slot);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'readings'::regclass
      AND contype = 'f'
      AND confrelid = 'users'::regclass
      AND conname = 'readings_user_id_fkey'
      AND confdeltype = 'c'
  ) THEN
    ALTER TABLE readings DROP CONSTRAINT IF EXISTS readings_user_id_fkey;
    ALTER TABLE readings
      ADD CONSTRAINT readings_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON users (lower(email));

REVOKE ALL ON DATABASE sweety FROM PUBLIC;
REVOKE ALL ON DATABASE sweety_test FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO sweety_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sweety_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sweety_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sweety_migrate IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sweety_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sweety_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sweety_app;
