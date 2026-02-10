-- CHECK 1: Verify the specific appointment exists and has the correct status
SELECT id, doctor_id, branch_id, status, appointment_date 
FROM appointments 
WHERE status = 'confirmed';

-- CHECK 2: Verify the staff record for the doctor (replace EMAIL with doctor's email)
SELECT s.id as staff_id, s.full_name, u.email 
FROM staff s
JOIN auth.users u ON s.user_id = u.id
WHERE u.email = 'doctor@example.com'; -- REPLACE THIS

-- CHECK 3: Verify the RLS visibility (simulate the doctor view)
-- You can't easily simulate 'auth.uid()' in a simple query window without setting role, 
-- but you can check if the IDs match from Check 1 and Check 2.
-- If staff_id from Check 2 matches doctor_id from Check 1, the RLS *should* work.
