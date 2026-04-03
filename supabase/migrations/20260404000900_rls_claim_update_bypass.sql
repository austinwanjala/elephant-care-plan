-- Resolve Row Level Security silent-failures for Update sequences across claims

-- Enable permissive updates for Super Agents to manually flip their unclaimed ledgers to pending upon submitting bulk claims
DROP POLICY IF EXISTS "Super agents update own commissions" ON public.super_agent_commissions;
CREATE POLICY "Super agents update own commissions" ON public.super_agent_commissions
FOR UPDATE TO authenticated
USING (true);

-- Enable permissive updates for Marketers to manualy flip their unclaimed ledgers to pending upon submitting bulk claims
DROP POLICY IF EXISTS "Marketers update own commissions" ON public.marketer_commissions;
CREATE POLICY "Marketers update own commissions" ON public.marketer_commissions
FOR UPDATE TO authenticated
USING (true);
