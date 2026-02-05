-- Fix RLS policies for marketers table
-- The issue is that marketers can't read their own profile

-- Drop existing policies
DROP POLICY IF EXISTS "Marketers can view their own profile." ON public.marketers;
DROP POLICY IF EXISTS "Marketers can update their own profile." ON public.marketers;
DROP POLICY IF EXISTS "Admins can manage marketers." ON public.marketers;
DROP POLICY IF EXISTS "Allow public read access to marketers" ON public.marketers;

-- Recreate policies with correct permissions
-- 1. Marketers can view their own profile
CREATE POLICY "marketers_select_own" ON public.marketers
FOR SELECT USING (auth.uid() = user_id);

-- 2. Marketers can update their own profile
CREATE POLICY "marketers_update_own" ON public.marketers
FOR UPDATE USING (auth.uid() = user_id);

-- 3. Admins can manage all marketers
CREATE POLICY "marketers_admin_all" ON public.marketers
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 4. Allow anonymous/authenticated users to read marketers (for registration page)
CREATE POLICY "marketers_public_read" ON public.marketers
FOR SELECT TO anon, authenticated USING (true);

-- Verify policies are created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'marketers'
ORDER BY policyname;
