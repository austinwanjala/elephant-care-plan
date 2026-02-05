-- Ensure branches is readable by authenticated users (or at least admins/staff)
CREATE POLICY "Staff can view branches" ON "public"."branches"
    FOR SELECT USING (auth.role() = 'authenticated');

-- Ensure branch_claims policies are correct
DROP POLICY IF EXISTS "Directors can view their branch claims" ON "public"."branch_claims";
CREATE POLICY "Directors can view their branch claims" ON "public"."branch_claims"
    FOR SELECT USING (
        (auth.uid() IN (SELECT user_id FROM staff WHERE branch_id = branch_claims.branch_id AND role = 'branch_director'))
        OR 
        (auth.uid() IN (SELECT user_id FROM staff WHERE role = 'admin'))
    );

-- Add explicit SELECT for admins if previous one is tricky
CREATE POLICY "Admins can view all claims" ON "public"."branch_claims"
    FOR SELECT USING (
        auth.uid() IN (SELECT user_id FROM staff WHERE role = 'admin')
    );

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Admins can update claims" ON "public"."branch_claims";
CREATE POLICY "Admins can update claims" ON "public"."branch_claims"
    FOR UPDATE USING (
        auth.uid() IN (SELECT user_id FROM staff WHERE role = 'admin')
    );
