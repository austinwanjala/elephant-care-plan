-- Add marketer commission to scheme levels
ALTER TABLE public.membership_categories ADD COLUMN marketer_commission NUMERIC DEFAULT 0;

-- Update branches to have a text status if not already
ALTER TABLE public.branches ADD COLUMN status TEXT DEFAULT 'active';

-- Create branch_fines table
CREATE TABLE IF NOT EXISTS public.branch_fines (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    auditor_id UUID REFERENCES public.staff(id),
    amount NUMERIC DEFAULT 0,
    reason TEXT NOT NULL,
    warning_level INTEGER NOT NULL, -- 1: First Warning, 2: Second (Suspension), 3: Third (Termination)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'unpaid' -- unpaid, paid, appealed
);

-- Turn on RLS
ALTER TABLE public.branch_fines ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Auditors can manage fines" ON public.branch_fines
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND role IN ('auditor', 'admin')
        )
    );

CREATE POLICY "Staff can view their branch fines" ON public.branch_fines
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE staff.user_id = auth.uid() 
            AND staff.branch_id = branch_fines.branch_id
        ) OR EXISTS (
            SELECT 1 FROM public.branch_directors
            WHERE branch_directors.user_id = auth.uid()
            AND branch_directors.branch_id = branch_fines.branch_id
        )
    );

-- Update the trigger function to use the membership category commission
CREATE OR REPLACE FUNCTION public.create_marketer_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    commission_amount NUMERIC;
BEGIN
    -- Only trigger if the member is being activated and has a marketer
    IF NEW.is_active = TRUE AND (OLD.is_active = FALSE OR OLD.is_active IS NULL) AND NEW.marketer_id IS NOT NULL THEN
        
        -- 1. Try to get the rate from the member's membership category
        SELECT marketer_commission INTO commission_amount
        FROM public.membership_categories
        WHERE id = NEW.membership_category_id;
        
        -- 2. Fallback to older config table if category has no commission (0 or null)
        IF commission_amount IS NULL OR commission_amount = 0 THEN
            SELECT commission_per_referral INTO commission_amount
            FROM public.marketer_commission_config
            ORDER BY updated_at DESC
            LIMIT 1;
        END IF;

        -- 3. Final safety fallback
        commission_amount := COALESCE(commission_amount, 0);
        
        -- Insert the commission record
        INSERT INTO public.marketer_commissions (marketer_id, member_id, amount, status)
        VALUES (NEW.marketer_id, NEW.id, commission_amount, 'unclaimed')
        ON CONFLICT (marketer_id, member_id) DO NOTHING;
        
    END IF;
    RETURN NEW;
END;
$function$;
