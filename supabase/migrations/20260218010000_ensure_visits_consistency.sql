-- Comprehensive Fix for 'visits' table columns, RLS, 'dental_records', 'bills', and 'bill_items'
-- Migration: 20260218010000_ensure_visits_consistency.sql

DO $$ 
BEGIN
    -- 1. SCHEMA RECONCILIATION (VISITS)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'biometrics_verified') THEN
        ALTER TABLE public.visits ADD COLUMN biometrics_verified BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'status') THEN
        ALTER TABLE public.visits ADD COLUMN status TEXT DEFAULT 'registered';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'receptionist_id') THEN
        ALTER TABLE public.visits ADD COLUMN receptionist_id UUID REFERENCES public.staff(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'doctor_id') THEN
        ALTER TABLE public.visits ADD COLUMN doctor_id UUID REFERENCES public.staff(id);
    END IF;

    -- Add missing diagnosis and notes columns to visits
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'diagnosis') THEN
        ALTER TABLE public.visits ADD COLUMN diagnosis TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'treatment_notes') THEN
        ALTER TABLE public.visits ADD COLUMN treatment_notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'benefit_deducted') THEN
        ALTER TABLE public.visits ADD COLUMN benefit_deducted NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'branch_compensation') THEN
        ALTER TABLE public.visits ADD COLUMN branch_compensation NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'profit_loss') THEN
        ALTER TABLE public.visits ADD COLUMN profit_loss NUMERIC DEFAULT 0;
    END IF;

    -- Audit columns for visits
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'created_at') THEN
        ALTER TABLE public.visits ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'updated_at') THEN
        ALTER TABLE public.visits ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;

    -- Make service_id nullable as it is not always known at registration
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'service_id') THEN
        ALTER TABLE public.visits ALTER COLUMN service_id DROP NOT NULL;
    END IF;

    -- Update status to be NOT NULL if it exists
    ALTER TABLE public.visits ALTER COLUMN status SET DEFAULT 'registered';
    UPDATE public.visits SET status = 'registered' WHERE status IS NULL;
    ALTER TABLE public.visits ALTER COLUMN status SET NOT NULL;

    -- 2. RLS CLEANUP (VISITS)
    -- Drop all legacy and new policy names to ensure a clean state
    DROP POLICY IF EXISTS "Staff can create visits" ON public.visits;
    DROP POLICY IF EXISTS "Members view own visits" ON public.visits;
    DROP POLICY IF EXISTS "Members can view their own visits." ON public.visits;
    DROP POLICY IF EXISTS "Staff view visits" ON public.visits;
    DROP POLICY IF EXISTS "Staff can manage visits in their branch." ON public.visits;
    DROP POLICY IF EXISTS "Admins can manage all visits." ON public.visits;
    DROP POLICY IF EXISTS "Admins can manage visits" ON public.visits;
    
    DROP POLICY IF EXISTS "visits_select_member" ON public.visits;
    DROP POLICY IF EXISTS "visits_select_staff" ON public.visits;
    DROP POLICY IF EXISTS "visits_insert_staff" ON public.visits;
    DROP POLICY IF EXISTS "visits_update_staff" ON public.visits;

    -- 3. NEW ROBUST POLICIES (VISITS)
    -- Members can view their own visits
    CREATE POLICY "visits_select_member" ON public.visits
    FOR SELECT USING (
        member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    );

    -- Staff can view visits in their branch
    CREATE POLICY "visits_select_staff" ON public.visits
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE user_id = auth.uid() 
            AND branch_id = visits.branch_id
        ) OR public.has_role(auth.uid(), 'admin')
    );

    -- Receptionists and Admins can register (insert) visits
    CREATE POLICY "visits_insert_staff" ON public.visits
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('receptionist', 'admin', 'branch_director')
        )
    );

    -- Doctors and Receptionists can update visits in their branch (for status updates etc)
    CREATE POLICY "visits_update_staff" ON public.visits
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE user_id = auth.uid() 
            AND branch_id = visits.branch_id
        ) OR public.has_role(auth.uid(), 'admin')
    );

    -- 4. DENTAL RECORDS RECONCILIATION
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dental_records') THEN
        CREATE TABLE public.dental_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
            visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
            tooth_number INTEGER NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            UNIQUE (member_id, tooth_number)
        );
    ELSE
        -- Ensure 'notes' column exists (it was procedure_notes in one migration)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dental_records' AND column_name = 'notes') THEN
            ALTER TABLE public.dental_records ADD COLUMN notes TEXT;
        END IF;

        -- Ensure visit_id FK points to visits(id) not member_visits
        ALTER TABLE public.dental_records DROP CONSTRAINT IF EXISTS dental_records_visit_id_fkey;
        ALTER TABLE public.dental_records ADD CONSTRAINT dental_records_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE SET NULL;
    END IF;

    -- RLS for dental_records
    ALTER TABLE public.dental_records ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Doctors can manage dental records for members in their visits." ON public.dental_records;
    DROP POLICY IF EXISTS "Members can view their own dental records." ON public.dental_records;
    DROP POLICY IF EXISTS "Admins can manage all dental records." ON public.dental_records;
    DROP POLICY IF EXISTS "dental_records_select_member" ON public.dental_records;
    DROP POLICY IF EXISTS "dental_records_all_staff" ON public.dental_records;

    CREATE POLICY "dental_records_select_member" ON public.dental_records
    FOR SELECT USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

    CREATE POLICY "dental_records_all_staff" ON public.dental_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('doctor', 'receptionist', 'admin', 'branch_director')
        )
    );

    -- 5. BILLS AND BILL ITEMS RECONCILIATION
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bills') THEN
        CREATE TABLE public.bills (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            visit_id UUID NOT NULL UNIQUE REFERENCES public.visits(id) ON DELETE CASCADE,
            receptionist_id UUID REFERENCES public.staff(id),
            total_benefit_cost NUMERIC NOT NULL DEFAULT 0,
            total_branch_compensation NUMERIC NOT NULL DEFAULT 0,
            total_real_cost NUMERIC NOT NULL DEFAULT 0,
            total_profit_loss NUMERIC NOT NULL DEFAULT 0,
            is_finalized BOOLEAN DEFAULT FALSE,
            finalized_at TIMESTAMP WITH TIME ZONE
        );
    ELSE
        -- Ensure 'is_finalized' exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'is_finalized') THEN
            ALTER TABLE public.bills ADD COLUMN is_finalized BOOLEAN DEFAULT FALSE;
        END IF;

        -- Ensure 'receptionist_id' exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'receptionist_id') THEN
            ALTER TABLE public.bills ADD COLUMN receptionist_id UUID REFERENCES public.staff(id);
        END IF;

        -- Ensure 'total_benefit_cost' exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'total_benefit_cost') THEN
            ALTER TABLE public.bills ADD COLUMN total_benefit_cost NUMERIC DEFAULT 0;
        END IF;

        -- Ensure financial columns exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'total_branch_compensation') THEN
            ALTER TABLE public.bills ADD COLUMN total_branch_compensation NUMERIC DEFAULT 0;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'total_real_cost') THEN
            ALTER TABLE public.bills ADD COLUMN total_real_cost NUMERIC DEFAULT 0;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'total_profit_loss') THEN
            ALTER TABLE public.bills ADD COLUMN total_profit_loss NUMERIC DEFAULT 0;
        END IF;

        -- Make member_id nullable as it is redundant (linked via visit_id)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'member_id') THEN
            ALTER TABLE public.bills ALTER COLUMN member_id DROP NOT NULL;
        END IF;

        -- Ensure branch_id column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'branch_id') THEN
            ALTER TABLE public.bills ADD COLUMN branch_id UUID REFERENCES public.branches(id);
        END IF;

        -- Backfill branch_id from visits
        UPDATE public.bills b
        SET branch_id = v.branch_id
        FROM public.visits v
        WHERE b.visit_id = v.id AND b.branch_id IS NULL;
    END IF;

    -- RLS for bills
    ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Doctors can create bills for their visits." ON public.bills;
    DROP POLICY IF EXISTS "Receptionists can update and finalize bills." ON public.bills;
    DROP POLICY IF EXISTS "Admins can view all bills." ON public.bills;
    DROP POLICY IF EXISTS "Doctors can view bills for their visits." ON public.bills;
    DROP POLICY IF EXISTS "Branch Directors can view bills for their branch." ON public.bills;
    DROP POLICY IF EXISTS "Staff view bills" ON public.bills;
    DROP POLICY IF EXISTS "Doctor create bill" ON public.bills;
    DROP POLICY IF EXISTS "Receptionist update bill" ON public.bills;
    DROP POLICY IF EXISTS "bills_all_staff" ON public.bills;

    CREATE POLICY "bills_all_staff" ON public.bills
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('doctor', 'receptionist', 'admin', 'branch_director')
        )
    );

    -- Bill Items
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bill_items') THEN
        CREATE TABLE public.bill_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
            service_id UUID NOT NULL REFERENCES public.services(id),
            service_name TEXT NOT NULL,
            benefit_cost NUMERIC NOT NULL,
            branch_compensation NUMERIC NOT NULL,
            real_cost NUMERIC NOT NULL
        );
    ELSE
        -- Ensure service_name exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'service_name') THEN
            ALTER TABLE public.bill_items ADD COLUMN service_name TEXT DEFAULT '';
            UPDATE public.bill_items bi SET service_name = s.name FROM public.services s WHERE bi.service_id = s.id;
            ALTER TABLE public.bill_items ALTER COLUMN service_name SET NOT NULL;
        END IF;

        -- Make profit_loss nullable as it is redundant (can be calculated)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'profit_loss') THEN
            ALTER TABLE public.bill_items ALTER COLUMN profit_loss DROP NOT NULL;
        END IF;
    END IF;

    -- RLS for bill_items
    ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can view bill items if they can view the bill." ON public.bill_items;
    DROP POLICY IF EXISTS "Doctors can insert bill items for their bills." ON public.bill_items;
    DROP POLICY IF EXISTS "Staff view bill items" ON public.bill_items;
    DROP POLICY IF EXISTS "bill_items_all_staff" ON public.bill_items;

    CREATE POLICY "bill_items_all_staff" ON public.bill_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('doctor', 'receptionist', 'admin', 'branch_director')
        )
    );

END $$;

-- 6. RPC: finalize_bill
DROP FUNCTION IF EXISTS public.finalize_bill(UUID, UUID);
CREATE OR REPLACE FUNCTION public.finalize_bill(_bill_id UUID, _receptionist_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_visit_id UUID;
    v_member_id UUID;
    v_total_benefit DECIMAL;
    v_current_coverage DECIMAL;
    v_branch_id UUID;
    v_total_compensation DECIMAL;
BEGIN
    -- Get bill details
    SELECT visit_id, total_benefit_cost, total_branch_compensation 
    INTO v_visit_id, v_total_benefit, v_total_compensation
    FROM public.bills WHERE id = _bill_id;

    -- Get visit details
    SELECT member_id, branch_id INTO v_member_id, v_branch_id
    FROM public.visits WHERE id = v_visit_id;

    -- Check coverage
    SELECT coverage_balance INTO v_current_coverage
    FROM public.members WHERE id = v_member_id;

    IF v_current_coverage < v_total_benefit THEN
        RAISE EXCEPTION 'Insufficient coverage balance';
    END IF;

    -- Deduct coverage
    UPDATE public.members 
    SET coverage_balance = coverage_balance - v_total_benefit
    WHERE id = v_member_id;

    -- Mark bill as finalized and ensure branch_id is set
    UPDATE public.bills 
    SET is_finalized = true, 
        finalized_at = now(),
        branch_id = v_branch_id,
        receptionist_id = _receptionist_id
    WHERE id = _bill_id;

    -- Update visit status and record biometric verification for finalization
    UPDATE public.visits
    SET status = 'completed', 
        biometrics_verified = true,
        benefit_deducted = v_total_benefit,
        branch_compensation = v_total_compensation,
        updated_at = now()
    WHERE id = v_visit_id;

    -- Update branch revenue summary
    INSERT INTO public.branch_revenue (branch_id, date, total_compensation, total_benefit_deductions, visit_count)
    VALUES (v_branch_id, CURRENT_DATE, v_total_compensation, v_total_benefit, 1)
    ON CONFLICT (branch_id, date) 
    DO UPDATE SET
        total_compensation = branch_revenue.total_compensation + EXCLUDED.total_compensation,
        total_benefit_deductions = branch_revenue.total_benefit_deductions + EXCLUDED.total_benefit_deductions,
        visit_count = branch_revenue.visit_count + 1,
        updated_at = now();

    -- 7. CLEANUP OLD TRIGGERS
    -- Drop the old trigger that updated branch_revenue on visit creation
    -- We now update revenue only when bills are finalized to avoid double counting
    DROP TRIGGER IF EXISTS on_visit_created ON public.visits;

END;
$$;
