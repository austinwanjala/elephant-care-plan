-- Migration: 20260306060000_fix_appointment_relationships.sql
-- Description: Explicitly adds Foreign Key constraints to appointments table to ensure PostgREST can detect relationships.

DO $$
BEGIN
    -- 1. Member FK
    -- Check if constraint exists, if not add it. 
    -- We use a specific name 'appointments_member_id_fkey' to be sure.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_member_id_fkey') THEN
        -- If a different constraint exists on member_id, we might want to drop it first, but let's try adding this specific one.
        ALTER TABLE public.appointments
        ADD CONSTRAINT appointments_member_id_fkey
        FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;
    END IF;

    -- 2. Dependant FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_dependant_id_fkey') THEN
        ALTER TABLE public.appointments
        ADD CONSTRAINT appointments_dependant_id_fkey
        FOREIGN KEY (dependant_id) REFERENCES public.dependants(id) ON DELETE SET NULL;
    END IF;

    -- 3. Doctor/Staff FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_doctor_id_fkey') THEN
        ALTER TABLE public.appointments
        ADD CONSTRAINT appointments_doctor_id_fkey
        FOREIGN KEY (doctor_id) REFERENCES public.staff(id) ON DELETE CASCADE;
    END IF;
    
    -- 4. Branch FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_branch_id_fkey') THEN
        ALTER TABLE public.appointments
        ADD CONSTRAINT appointments_branch_id_fkey
        FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;
    END IF;
    
    -- 5. Service FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_service_id_fkey') THEN
        ALTER TABLE public.appointments
        ADD CONSTRAINT appointments_service_id_fkey
        FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;
    END IF;

END $$;
