-- Migration: 20260308113000_restore_legacy_finalize.sql

-- Restore the original function signature to support cached clients that are still calling 'finalize_bill'
-- This acts as a wrapper/alias to the new logic or just duplicates it to be safe.

CREATE OR REPLACE FUNCTION public.finalize_bill(
    _bill_id UUID,
    _receptionist_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Forward the call to the new robust function
    -- Note: valid only if parameters map 1:1, which they do
    PERFORM public.finalize_visit_bill(_bill_id, _receptionist_id);
END;
$$;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.finalize_bill(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_bill(UUID, UUID) TO service_role;
