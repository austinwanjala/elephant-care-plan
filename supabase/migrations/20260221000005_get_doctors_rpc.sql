-- Create a secure RPC function to fetch doctors for a branch
-- This bypasses RLS complexity by running as a security definer function tailored for this specific use case.

CREATE OR REPLACE FUNCTION public.get_branch_doctors(branch_id_input UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.full_name, s.user_id
  FROM public.staff s
  JOIN public.user_roles ur ON s.user_id = ur.user_id
  WHERE s.branch_id = branch_id_input
  AND s.is_active = true
  AND ur.role = 'doctor';
END;
$$;
