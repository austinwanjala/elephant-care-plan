-- Migration: 20260306040000_fix_availability_rpc.sql
-- Description: Refactors get_doctor_availability to use explicit logic variables and ensure fallbacks work.

CREATE OR REPLACE FUNCTION public.get_doctor_availability(p_doctor_id UUID, p_date DATE)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_day_of_week INTEGER;
    v_start_time TIME;
    v_end_time TIME;
    v_slot_duration INTEGER := 30; -- Default 30 mins
    v_slots TEXT[] := ARRAY[]::TEXT[];
    v_curr_time TIME;
    v_is_taken BOOLEAN;
    v_branch_id UUID;
    v_schedule_found BOOLEAN := FALSE;
BEGIN
    -- 1. Get Day of Week (0=Sunday, 6=Saturday)
    v_day_of_week := EXTRACT(DOW FROM p_date);

    -- 2. Check Doctor's Schedule
    -- Use explicit variables instead of RECORD to be safer
    SELECT start_time, end_time INTO v_start_time, v_end_time
    FROM public.doctor_schedules
    WHERE doctor_id = p_doctor_id
      AND day_of_week = v_day_of_week
      AND is_active = TRUE;

    IF FOUND THEN
        v_schedule_found := TRUE;
    END IF;

    -- 3. Fallback to Branch Settings if no doctor schedule found
    IF NOT v_schedule_found THEN
        -- Get Branch ID
        SELECT branch_id INTO v_branch_id FROM public.staff WHERE id = p_doctor_id;
        
        IF v_branch_id IS NOT NULL THEN
            SELECT opening_time, closing_time, slot_duration_minutes 
            INTO v_start_time, v_end_time, v_slot_duration
            FROM public.appointment_settings 
            WHERE branch_id = v_branch_id;
            
            IF NOT FOUND THEN
                 -- Branch has no settings? Use Defaults.
                 v_start_time := '09:00:00';
                 v_end_time := '17:00:00';
            END IF;
        ELSE
            -- Doctor has no branch? Use Defaults.
            v_start_time := '09:00:00';
            v_end_time := '17:00:00';
        END IF;
    END IF;

    -- Handle NULLs just in case
    IF v_start_time IS NULL THEN v_start_time := '09:00:00'; END IF;
    IF v_end_time IS NULL THEN v_end_time := '17:00:00'; END IF;
    IF v_slot_duration IS NULL THEN v_slot_duration := 30; END IF;

    -- 4. Generate Slots
    v_curr_time := v_start_time;
    
    -- Ensure loop terminates
    WHILE v_curr_time < v_end_time LOOP
        -- Check collisions
        v_is_taken := FALSE;
        
        PERFORM 1 FROM public.appointments 
        WHERE doctor_id = p_doctor_id 
          AND appointment_date = p_date 
          AND status NOT IN ('cancelled', 'no_show', 'rejected') -- Added rejected if it exists
          AND start_time = v_curr_time; 
          
        IF FOUND THEN
            v_is_taken := TRUE;
        END IF;

        IF NOT v_is_taken THEN
            v_slots := array_append(v_slots, v_curr_time::TEXT);
        END IF;

        -- Increment time
        v_curr_time := v_curr_time + (v_slot_duration || ' minutes')::INTERVAL;
    END LOOP;

    RETURN v_slots;
END;
$$;
