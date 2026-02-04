
-- Fix RLS policies for marketers table - change from RESTRICTIVE to PERMISSIVE
-- Drop all existing policies
DROP POLICY IF EXISTS "Marketers can view own profile" ON public.marketers;
DROP POLICY IF EXISTS "Admins can manage marketers" ON public.marketers;
DROP POLICY IF EXISTS "marketers_select_own" ON public.marketers;
DROP POLICY IF EXISTS "marketers_update_own" ON public.marketers;
DROP POLICY IF EXISTS "marketers_admin_all" ON public.marketers;
DROP POLICY IF EXISTS "marketers_public_read" ON public.marketers;

-- Recreate policies as PERMISSIVE (default)
-- 1. Marketers can view their own profile
CREATE POLICY "marketers_select_own_permissive" ON public.marketers
AS PERMISSIVE FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 2. Marketers can update their own profile  
CREATE POLICY "marketers_update_own_permissive" ON public.marketers
AS PERMISSIVE FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- 3. Admins can do everything
CREATE POLICY "marketers_admin_manage" ON public.marketers
AS PERMISSIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND role = 'admin'));

-- 4. Public read for registration page (to show marketer codes)
CREATE POLICY "marketers_public_select" ON public.marketers
AS PERMISSIVE FOR SELECT TO authenticated
USING (true);

-- Fix RLS policies for members table to allow marketers to view their referrals
DROP POLICY IF EXISTS "Marketers can view referred members" ON public.members;

CREATE POLICY "marketers_view_referred_members" ON public.members
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  marketer_id IN (SELECT id FROM marketers WHERE marketers.user_id = auth.uid())
);

-- Fix RLS for marketer_commissions
DROP POLICY IF EXISTS "marketers_view_own_commissions" ON public.marketer_commissions;

CREATE POLICY "marketers_view_own_commissions_permissive" ON public.marketer_commissions
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  marketer_id IN (SELECT id FROM marketers WHERE marketers.user_id = auth.uid())
);
