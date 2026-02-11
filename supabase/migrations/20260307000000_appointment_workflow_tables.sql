-- Migration: 20260307000000_appointment_workflow_tables.sql
-- Description: Adds tables for appointment approvals, notifications, and updates status constraints.

-- 1. Ensure Appointment Status Check Constraint matches requirements
-- We need to drop the old check to update it safely or just add the new one.
-- Existing: 'pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'rescheduled'
-- We just want to ensure these are enforced.

ALTER TABLE public.appointments
DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'rescheduled', 'rejected'));

-- 2. Appointment Approvals Table
CREATE TABLE IF NOT EXISTS public.appointment_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'rescheduled', 'cancelled', 'checked_in', 'completed', 'requested')),
    performed_by UUID REFERENCES auth.users(id), -- Nullable for system actions? Or use system user?
    role TEXT NOT NULL, -- 'admin', 'branch_director', 'receptionist', 'doctor', 'member', 'system'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for approvals
CREATE INDEX IF NOT EXISTS idx_appointment_approvals_appt ON public.appointment_approvals(appointment_id);

-- 3. Appointment Notifications Table (Log for SMS)
CREATE TABLE IF NOT EXISTS public.appointment_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- 'created', 'approved', 'rejected', 'reminder_24h', 'reminder_1h', 'cancelled'
    recipient_phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    message TEXT,
    provider_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Index for notifications
CREATE INDEX IF NOT EXISTS idx_appointment_notifications_appt ON public.appointment_notifications(appointment_id);

-- 4. RLS Policies

-- Appointment Approvals
ALTER TABLE public.appointment_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view approvals" ON public.appointment_approvals
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

CREATE POLICY "Members view own approvals" ON public.appointment_approvals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.appointments a 
            JOIN public.members m ON m.id = a.member_id
            WHERE a.id = appointment_approvals.appointment_id
            AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff manage approvals" ON public.appointment_approvals
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
    );
    
-- Appointment Notifications
ALTER TABLE public.appointment_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view notifications" ON public.appointment_notifications
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- 5. Trigger to log approval/audit on status change
CREATE OR REPLACE FUNCTION public.log_appointment_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_role TEXT;
    v_action TEXT;
BEGIN
    v_user_id := auth.uid();
    
    -- Determine action based on new status
    IF NEW.status = 'confirmed' THEN v_action := 'approved';
    ELSIF NEW.status = 'cancelled' THEN v_action := 'cancelled';
    ELSIF NEW.status = 'checked_in' THEN v_action := 'checked_in';
    ELSIF NEW.status = 'completed' THEN v_action := 'completed';
    ELSIF NEW.status = 'rejected' THEN v_action := 'rejected';
    ELSIF NEW.status = 'rescheduled' THEN v_action := 'rescheduled';
    ELSE v_action := 'requested';
    END IF;

    -- Attempt to find role
    IF v_user_id IS NOT NULL THEN
        SELECT role INTO v_role FROM public.user_roles WHERE user_id = v_user_id LIMIT 1;
    ELSE
        v_role := 'system';
    END IF;

    -- Insert log if status changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.appointment_approvals (appointment_id, action, performed_by, role, notes)
        VALUES (NEW.id, v_action, v_user_id, COALESCE(v_role, 'unknown'), 'Status changed from ' || OLD.status || ' to ' || NEW.status);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_appointment_status ON public.appointments;
CREATE TRIGGER tr_log_appointment_status
    AFTER UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.log_appointment_status_change();
