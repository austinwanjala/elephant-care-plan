-- Migration: 20260306050000_ensure_appointment_schema.sql
-- Description: Re-runs the creation of appointment tables to ensure they exist.

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
    UNIQUE(branch_id)
);

-- 2. Doctor Schedules
CREATE TABLE IF NOT EXISTS public.doctor_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
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
    end_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'rescheduled')),
    notes TEXT,
    visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_member ON public.appointments(member_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON public.appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_branch_date ON public.appointments(branch_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_schedules_doctor ON public.doctor_schedules(doctor_id);

-- RLS Policies (Idempotent checks)
DO $$
BEGIN
    -- Appointment Settings
    ALTER TABLE public.appointment_settings ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointment_settings' AND policyname = 'Everyone can view settings') THEN
        CREATE POLICY "Everyone can view settings" ON public.appointment_settings FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointment_settings' AND policyname = 'Admins manage settings') THEN
        CREATE POLICY "Admins manage settings" ON public.appointment_settings FOR ALL USING (
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'branch_director'))
        );
    END IF;

    -- Doctor Schedules
    ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'doctor_schedules' AND policyname = 'Everyone can view schedules') THEN
        CREATE POLICY "Everyone can view schedules" ON public.doctor_schedules FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'doctor_schedules' AND policyname = 'Admins/Doctors manage schedules') THEN
        CREATE POLICY "Admins/Doctors manage schedules" ON public.doctor_schedules FOR ALL USING (
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'branch_director', 'doctor'))
        );
    END IF;

    -- Appointments
    ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'Members view own appointments') THEN
        CREATE POLICY "Members view own appointments" ON public.appointments FOR SELECT USING (
            member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'Members create appointments') THEN
        CREATE POLICY "Members create appointments" ON public.appointments FOR INSERT WITH CHECK (
            member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()) OR
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'receptionist'))
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'Members update own appointments') THEN
        CREATE POLICY "Members update own appointments" ON public.appointments FOR UPDATE USING (
             member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
        );
    END IF;

    -- Staff policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'Staff view branch appointments') THEN
        CREATE POLICY "Staff view branch appointments" ON public.appointments FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND branch_id = appointments.branch_id)
            OR
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'receptionist', 'doctor'))
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'Staff manage branch appointments') THEN
        CREATE POLICY "Staff manage branch appointments" ON public.appointments FOR ALL USING (
            EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND branch_id = appointments.branch_id)
            OR
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
        );
    END IF;
    
END $$;
