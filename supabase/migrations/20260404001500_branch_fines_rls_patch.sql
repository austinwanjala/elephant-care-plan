-- Allow Branch Directors/Staff to update payment details on branch_fines
CREATE POLICY "Directors can submit fine payments" ON public.branch_fines
    FOR UPDATE
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

-- Allow Finance teams to manage fines
CREATE POLICY "Finance can manage branch fines" ON public.branch_fines
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND role IN ('finance', 'super_admin')
        )
    );

-- Ensure Finance can update branch status to active after payment
CREATE POLICY "Finance can manage branch table status" ON public.branches
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND role IN ('finance', 'super_admin')
        )
    );
