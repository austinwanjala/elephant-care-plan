CREATE OR REPLACE FUNCTION public.check_in_appointment(_appointment_id UUID, _receptionist_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appt RECORD;
    v_visit_id UUID;
BEGIN
    -- Get appointment
    SELECT * INTO v_appt FROM public.appointments WHERE id = _appointment_id;
    
    IF v_appt IS NULL THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;

    IF v_appt.status = 'checked_in' OR v_appt.status = 'completed' THEN
        RAISE EXCEPTION 'Appointment already checked in';
    END IF;

    -- Create Visit with 'registered' status to appear in Doctor Queue
    INSERT INTO public.visits (
        member_id,
        dependant_id, -- Added dependant_id
        branch_id,
        doctor_id,
        service_id,
        receptionist_id,
        status,
        biometrics_verified,
        created_at,
        benefit_deducted,
        branch_compensation,
        profit_loss
    ) VALUES (
        v_appt.member_id,
        v_appt.dependant_id, -- Copy from appointment
        v_appt.branch_id,
        v_appt.doctor_id,
        v_appt.service_id,
        _receptionist_id,
        'registered',
        TRUE,
        now(),
        0,
        0,
        0
    ) RETURNING id INTO v_visit_id;

    -- Update Appointment
    UPDATE public.appointments
    SET status = 'checked_in',
        visit_id = v_visit_id,
        updated_at = now()
    WHERE id = _appointment_id;

    RETURN v_visit_id;
END;
$$;
