-- Migration: 20260309000005_reset_user_roles_policies.sql
-- Description: Drop ALL policies on user_roles and re-apply a clean read-only policy.
-- This resolves potential recursion or modification-blocking issues.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.user_roles';
    END LOOP;
END $$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 1. READ: Allow everyone to read roles (needed for UI)
CREATE POLICY "Allow authenticated to read user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- 2. WRITE: Allow Service Role (implicit) or Super Admin/Director via RPC?
-- RPC 'update_staff_role' is SECURITY DEFINER, so it bypasses RLS for the update.
-- We do NOT add an UPDATE/INSERT policy for client-side here to validatestrict ownership.
-- Only adding SELECT allows clients to Read but not Write directly (unless using Service Role).
