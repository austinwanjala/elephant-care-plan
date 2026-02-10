-- Migration: 20260306000000_create_appointment_tables.sql
-- Description: Creates tables for Appointments, Doctor Schedules, and Settings.

-- 1. Appointment Settings
CREATE TABLE IF NOT EXISTS public.appointment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE, -- Null means global default
    slot_duration_minutes INTEGER DEFAULT 30,
    opening_time TIME DEFAULT '08:00',
    closing_time TIME DEFAULT '17:00',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(branch_id) -- One setting per branch
);

-- 2. Doctor Schedules
CREATE TABLE IF NOT EXISTS public.doctor_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    dependant_id UUID REFERENCES public.dependants(id) ON DELETE SET NULL,
    doctor_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL, -- Calculated from slot duration
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'rescheduled')),
    notes TEXT,
    visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL, -- Link to visit when checked in
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_member ON public.appointments(member_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON public.appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_branch_date ON public.appointments(branch_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_schedules_doctor ON public.doctor_schedules(doctor_id);

-- RLS Policies

-- Appointment Settings
ALTER TABLE public.appointment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view settings" ON public.appointment_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings" ON public.appointment_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'branch_director'))
);

-- Doctor Schedules
ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view schedules" ON public.doctor_schedules FOR SELECT USING (true);
CREATE POLICY "Admins/Doctors manage schedules" ON public.doctor_schedules FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'branch_director', 'doctor'))
);

-- Appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Members: View/Create own
CREATE POLICY "Members view own appointments" ON public.appointments FOR SELECT USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);
CREATE POLICY "Members create appointments" ON public.appointments FOR INSERT WITH CHECK (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);
CREATE POLICY "Members cancel own appointments" ON public.appointments FOR UPDATE USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
) WITH CHECK (
    status = 'cancelled' -- Can only change status to cancelled
);

-- Staff: View/Manage branch appointments
CREATE POLICY "Staff view branch appointments" ON public.appointments FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND branch_id = appointments.branch_id)
    OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Staff manage branch appointments" ON public.appointments FOR ALL USING (
    EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND branch_id = appointments.branch_id)
    OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Function: Check In Appointment (Convert to Visit)
-- This creates a Visit record from an Appointment and updates the Appointment
CREATE OR REPLACE FUNCTION public.check_in_appointment(_appointment_id UUID, _receptionist_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appt RECORD;
    v_visit_id UUID;
    v_is_checked_in BOOLEAN;
BEGIN
    -- Get appointment
    SELECT * INTO v_appt FROM public.appointments WHERE id = _appointment_id;
    
    IF v_appt IS NULL THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;

    IF v_appt.status = 'checked_in' OR v_appt.status = 'completed' THEN
        RAISE EXCEPTION 'Appointment already checked in';
    END IF;

    -- Create Visit
    INSERT INTO public.visits (
        member_id,
        branch_id,
        doctor_id,
        service_id,
        receptionist_id,
        status,
        biometrics_verified, -- Assume verified if we are running this function (caller ensures)
        created_at
    ) VALUES (
        v_appt.member_id,
        v_appt.branch_id,
        v_appt.doctor_id,
        v_appt.service_id,
        _receptionist_id,
        'in_progress', -- Straight to doctor queue
        TRUE,
        now()
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
