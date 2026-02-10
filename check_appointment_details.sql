-- Run this to see the DATE and STATUS of the 2 appointments
SELECT 
    id, 
    appointment_date, 
    start_time, 
    status,
    created_at
FROM appointments 
WHERE doctor_id = 'f1abddee-80b0-47db-a89e-8438a8288d81';
