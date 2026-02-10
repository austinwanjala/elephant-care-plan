-- Check Foreign Keys and Columns for 'appointments' table
SELECT 
    conname AS constraint_name, 
    contype AS constraint_type, 
    pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c 
JOIN pg_namespace n ON n.oid = c.connamespace 
WHERE conrelid = 'public.appointments'::regclass;

-- Also check columns to ensure dependant_id exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointments';
