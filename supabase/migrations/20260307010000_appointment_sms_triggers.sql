-- Migration: 20260307010000_appointment_sms_triggers.sql

-- 1. Enable pg_net
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Function to Invoke SMS Edge Function
CREATE OR REPLACE FUNCTION public.invoke_appointment_sms()
RETURNS TRIGGER AS $$
DECLARE
    v_url TEXT := 'https://jjndhaxdxbbupmxiaixk.supabase.co/functions/v1/send-sms';
    v_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqbmRoYXhkeGJidXBteGlhaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNjEyNzcsImV4cCI6MjA4NTczNzI3N30.qp4alH2gd2v1o247mNJG6BNtazrYnjnBjbWhlM52y38';
    v_payload JSONB;
BEGIN
    -- Only proceed if status is 'pending' (newly created notification)
    IF NEW.status = 'pending' THEN
        -- Construct payload
        DECLARE
            v_appt RECORD;
            v_recipient_phone TEXT;
            v_doctor_name TEXT;
            v_branch_name TEXT;
            v_appt_date TEXT;
            v_appt_time TEXT;
        BEGIN
            SELECT a.*, d.full_name as doctor_name, b.name as branch_name, m.phone as member_phone
            INTO v_appt
            FROM public.appointments a
            LEFT JOIN public.staff d ON a.doctor_id = d.id
            LEFT JOIN public.branches b ON a.branch_id = b.id
            LEFT JOIN public.members m ON a.member_id = m.id
            WHERE a.id = NEW.appointment_id;
            
            -- Recipient phone is in NEW.recipient_phone or fallback to member
            v_recipient_phone := COALESCE(NEW.recipient_phone, v_appt.member_phone);
            v_doctor_name := COALESCE(v_appt.doctor_name, 'Unknown Doctor');
            v_branch_name := COALESCE(v_appt.branch_name, 'Main Branch');
            v_appt_date := to_char(v_appt.appointment_date, 'YYYY-MM-DD');
            v_appt_time := to_char(v_appt.start_time, 'HH24:MI');
            
            v_payload := jsonb_build_object(
                'type', NEW.type, 
                'phone', v_recipient_phone,
                'data', jsonb_build_object(
                    'doctor_name', v_doctor_name,
                    'branch_name', v_branch_name,
                    'date', v_appt_date,
                    'time', v_appt_time
                )
            );
            
            -- Call pg_net
            PERFORM net.http_post(
                url := v_url,
                headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
                body := v_payload
            );
            
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger on Appointment Notifications
DROP TRIGGER IF EXISTS tr_send_appointment_sms ON public.appointment_notifications;
CREATE TRIGGER tr_send_appointment_sms
    AFTER INSERT ON public.appointment_notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.invoke_appointment_sms();

-- 4. Function to Create Notification from Approval/Status Change
CREATE OR REPLACE FUNCTION public.create_notification_from_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_phone TEXT;
    v_notif_type TEXT;
BEGIN
    -- Fetch phone
    SELECT m.phone INTO v_phone
    FROM public.appointments a
    JOIN public.members m ON a.member_id = m.id
    WHERE a.id = NEW.appointment_id;
    
    -- Map action to notification type
    -- 'requested' -> 'appointment_pending'
    -- 'approved' -> 'appointment_booked'
    -- 'cancelled' -> 'appointment_cancelled'
    -- 'rescheduled' -> 'appointment_rescheduled'
    
    IF NEW.action = 'requested' THEN v_notif_type := 'appointment_pending';
    ELSIF NEW.action = 'approved' THEN v_notif_type := 'appointment_booked';
    ELSIF NEW.action = 'cancelled' THEN v_notif_type := 'appointment_cancelled';
    ELSIF NEW.action = 'rescheduled' THEN v_notif_type := 'appointment_rescheduled';
    ELSE RETURN NEW; 
    END IF;

    -- Insert into notifications
    INSERT INTO public.appointment_notifications (appointment_id, type, recipient_phone, status, message)
    VALUES (NEW.appointment_id, v_notif_type, v_phone, 'pending', 'Automated notification for ' || NEW.action);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger on Appointment Approvals
DROP TRIGGER IF EXISTS tr_create_notification_on_approval ON public.appointment_approvals;
CREATE TRIGGER tr_create_notification_on_approval
    AFTER INSERT ON public.appointment_approvals
    FOR EACH ROW
    EXECUTE FUNCTION public.create_notification_from_approval();
