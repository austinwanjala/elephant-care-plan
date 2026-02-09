-- Add unique constraint to key column to allow upsert operations
ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_key_key UNIQUE (key);