-- Migration: 20260306020000_add_availability_function.sql
-- Description: Adds RPC to calculate available appointment slots.

CREATE OR REPLACE FUNCTION public.get_doctor_availability(p_doctor_id UUID, p_date DATE)
RETURNS TEXT[] -- Returns array of time strings "HH:MM:SS"
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_day_of_week INTEGER;
    v_schedule RECORD;
    v_branch_settings RECORD;
    v_start_time TIME;
    v_end_time TIME;
    v_slot_duration INTEGER := 30; -- Default 30 mins
    v_slots TEXT[] := ARRAY[]::TEXT[];
    v_curr_time TIME;
    v_existing_appts RECORD;
    v_is_taken BOOLEAN;
BEGIN
    -- 1. Get Day of Week (0=Sunday, 6=Saturday)
    v_day_of_week := EXTRACT(DOW FROM p_date);

    -- 2. Check Doctor's Schedule
    SELECT * INTO v_schedule
    FROM public.doctor_schedules
    WHERE doctor_id = p_doctor_id
      AND day_of_week = v_day_of_week
      AND is_active = TRUE;

    -- 3. Determine Start/End Times
    IF v_schedule IS NOT NULL THEN
        v_start_time := v_schedule.start_time;
        v_end_time := v_schedule.end_time;
    ELSE
        -- Fallback to Branch Settings (if doctor has no specific schedule, maybe they follow branch hours?)
        -- First get doctor's branch
        SELECT branch_id INTO v_branch_settings FROM public.staff WHERE id = p_doctor_id;
        
        SELECT * INTO v_branch_settings 
        FROM public.appointment_settings 
        WHERE branch_id = (SELECT branch_id FROM public.staff WHERE id = p_doctor_id);

        IF v_branch_settings IS NOT NULL THEN
            v_start_time := v_branch_settings.opening_time;
            v_end_time := v_branch_settings.closing_time;
            v_slot_duration := v_branch_settings.slot_duration_minutes;
        ELSE
            -- Default fallback if no settings found
            v_start_time := '09:00:00';
            v_end_time := '17:00:00';
        END IF;
    END IF;

    -- 4. Generate Slots
    v_curr_time := v_start_time;
    
    WHILE v_curr_time < v_end_time LOOP
        -- Check if slot overlaps with existing appointments
        -- We consider a slot taken if an appointment starts at this time
        -- (Simplified collision detection)
        v_is_taken := FALSE;
        
        PERFORM 1 FROM public.appointments 
        WHERE doctor_id = p_doctor_id 
          AND appointment_date = p_date 
          AND status NOT IN ('cancelled', 'no_show')
          AND start_time = v_curr_time; -- Strict match for now? Or overlap?
          
        -- Better overlap check:
        -- Appt Start < Slot End AND Appt End > Slot Start
        -- Slot Start = v_curr_time
        -- Slot End = v_curr_time + duration
        
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
