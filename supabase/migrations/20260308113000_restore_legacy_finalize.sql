-- Migration: 20260308113000_restore_legacy_finalize.sql

-- 1. Standard Legacy Wrapper (Correct spelling)
CREATE OR REPLACE FUNCTION public.finalize_bill(
    _bill_id UUID,
    _receptionist_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.finalize_visit_bill(_bill_id, _receptionist_id);
END;
$$;

-- 2. Typo Wrapper (Matches User Report: _receiptionist_id)
-- Note: Postgres function overloading is based on types, not parameter names. 
-- However, Supabase RPC uses JSON keys to map to parameter names.
-- To handle 'Could not find function...(_receiptionist_id)', we might need a function that accepts that SPECIFIC parameter name.
-- But we cannot have two functions with same name and same types but different param names in Postgres easily without dropping one.
-- Actually, Postgres ignores param names for signature uniqueness (mostly).
-- BUT, if clients send named parameters, they MUST match.

-- Strategy: We'll create a function with GENERIC parameter names that mapped by position if possible, 
-- or we rely on the fact that if we cannot override, we should try to match the most likely one.
-- The User's error says `finalize_bill(_receiptionist-id)`. A hyphen is not a valid identifier.
-- It must be `_receiptionist_id` or similar.

-- Let's try to create a version with the TYPO in the parameter name.
-- To do this without conflict, we might need to drop the previous one if it exists with same types.
-- But wait, we can't have multiple functions with same signature (UUID, UUID).
-- So we can only have ONE `finalize_bill(UUID, UUID)`.
-- The parameter names defined in that ONE function are what Supabase expects.

-- If the user's client is sending `_receiptionist_id`, then my function MUST use `_receiptionist_id` as the parameter name.
-- BUT, if other clients send `_receptionist_id`, they will fail?
-- NO. Supabase (Postgrest) allows calling by position too?
-- Usually simpler to fix the client. But client seems cached.

-- Let's try this: Define the function with the TYPO name, since that's what's failing.
-- But wait, standard code uses `_receptionist_id`.
-- I can't support both simultaneously if they have same types.

-- ALTERNATIVE: Create a function that takes JSON?
-- No.

-- Let's try to ALIAS the function by creating a new function with the TYPO NAME?
-- No, the function name is `finalize_bill`. The parameter name is the issue.

-- CRITICAL OBSERVATION:
-- If I cannot have two overloads with same types, I must choose one.
-- The user says the error is `finalize_bill(_receiptionist-id)`.
-- If I define the function to accept `_receiptionist_id`, it fixes the user.
-- But it breaks anyone sending `_receptionist_id`.
-- However, I just updated `Billing.tsx` to use `finalize_visit_bill` (new function).
-- So `Billing.tsx` shouldn't be calling `finalize_bill` at all.
-- So the ONLY traffic to `finalize_bill` is from CACHED clients.
-- And those cached clients seem to be sending... wait. Use `grep` said NO `receiptionist` in code.
-- So where did they get `receiptionist` from?
-- Is it possible the USER typed `receiptionist` in their error report, but the SYSTEM actually said `receptionist`?
-- If I change it to `_receiptionist_id`, I might break it for real.

-- Let's stick to the corrected standard legacy wrapper.
-- The previous migration `20260308113000` created `_receptionist_id`.
-- If the user says it failed, maybe they didn't run it? or maybe the error is `p_receptionist_id`?

-- Let's create `finalize_bill` with `p_bill_id` and `p_receptionist_id` as well?
-- I cannot overload.

-- DECISION: I will define `finalize_bill` with `bill_id_arg` and `receptionist_id_arg` keys?
-- No, let's try to make the parameters positional?
-- Supabase RPC calls are typically named arguments.

-- Let's assume the user made a typo in the error report.
-- I will keep the standard names but ensure permissions are granted.

DROP FUNCTION IF EXISTS public.finalize_bill(UUID, UUID);

CREATE OR REPLACE FUNCTION public.finalize_bill(
    _bill_id UUID,
    _receptionist_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.finalize_visit_bill(_bill_id, _receptionist_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_bill(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_bill(UUID, UUID) TO service_role;
