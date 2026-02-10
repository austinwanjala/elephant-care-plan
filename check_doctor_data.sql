-- Run this in Supabase SQL Editor to see what is actually in the DB for this doctor

-- 1. Check ALL appointments for this doctor (Status check)
SELECT id, appointment_date, start_time, status, branch_id 
FROM appointments 
WHERE doctor_id = 'f1abddee-80b0-47db-a89e-8438a8288d81';

-- 2. Check if there are any appointments for today (2026-02-11) for ANY doctor
SELECT id, doctor_id, status 
FROM appointments 
WHERE appointment_date = '2026-02-11';

-- 3. Check if RLS is hiding them (Run this as a superuser/admin in SQL Editor implies bypass RLS usually, but good to check count)
SELECT count(*) as total_appointments_for_doc 
FROM appointments 
WHERE doctor_id = 'f1abddee-80b0-47db-a89e-8438a8288d81';
