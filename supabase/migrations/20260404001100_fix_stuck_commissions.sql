-- Migration: Fix stuck commissions that were manually processed before atomic RPC
UPDATE public.super_agent_commissions sac
SET status = 'paid'
FROM public.super_agent_claims cl
WHERE cl.super_agent_id = sac.super_agent_id
  AND cl.status = 'paid'
  AND sac.status IN ('pending', 'finance_review', 'unclaimed')
  AND sac.created_at <= cl.created_at;

UPDATE public.marketer_commissions mc
SET status = 'paid'
FROM public.marketer_claims mcl
WHERE mcl.marketer_id = mc.marketer_id
  AND mcl.status = 'paid'
  AND mc.status IN ('pending', 'finance_review', 'unclaimed')
  AND mc.created_at <= mcl.created_at;
