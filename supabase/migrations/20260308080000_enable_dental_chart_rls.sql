-- Enable RLS and add policies for dental_chart_records
ALTER TABLE public.dental_chart_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to be safe)
DROP POLICY IF EXISTS "Staff can view dental chart records" ON public.dental_chart_records;
DROP POLICY IF EXISTS "Members can view own dental chart records" ON public.dental_chart_records;

-- Policy for Staff (Doctors, Receptionists, Admins)
CREATE POLICY "Staff can view dental chart records" ON public.dental_chart_records
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('doctor', 'receptionist', 'admin', 'branch_director')
    )
);

-- Policy for Members
CREATE POLICY "Members can view own dental chart records" ON public.dental_chart_records
FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM public.members WHERE id = member_id)
);

-- Policy for Staff to Insert (Doctors mostly)
CREATE POLICY "Staff can insert dental chart records" ON public.dental_chart_records
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('doctor', 'admin')
    )
);
