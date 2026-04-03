-- Generate atomic RPC process mapping for finance operations securely
CREATE OR REPLACE FUNCTION public.process_claim(
    p_claim_id UUID, 
    p_action TEXT, 
    p_type TEXT, 
    p_notes TEXT, 
    p_admin_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_id UUID;
  v_existing_notes TEXT;
BEGIN
  IF p_type = 'marketer' THEN
    SELECT marketer_id, COALESCE(notes, '') INTO v_entity_id, v_existing_notes FROM public.marketer_claims WHERE id = p_claim_id;
    
    IF p_action = 'approve' THEN
      UPDATE public.marketer_claims SET status = 'finance_review', notes = v_existing_notes || CHR(10) || p_notes WHERE id = p_claim_id;
      UPDATE public.marketer_commissions SET status = 'finance_review' WHERE marketer_id = v_entity_id AND status = 'pending';
    ELSIF p_action = 'pay' THEN
      UPDATE public.marketer_claims SET status = 'paid', paid_at = NOW(), notes = v_existing_notes || CHR(10) || p_notes WHERE id = p_claim_id;
      UPDATE public.marketer_commissions SET status = 'paid' WHERE marketer_id = v_entity_id AND status IN ('pending', 'finance_review');
    ELSIF p_action = 'reject' THEN
      UPDATE public.marketer_claims SET status = 'rejected', notes = v_existing_notes || CHR(10) || p_notes WHERE id = p_claim_id;
      UPDATE public.marketer_commissions SET status = 'claimable' WHERE marketer_id = v_entity_id AND status IN ('pending', 'finance_review');
    END IF;
    
  ELSE
    SELECT super_agent_id, COALESCE(notes, '') INTO v_entity_id, v_existing_notes FROM public.super_agent_claims WHERE id = p_claim_id;
    
    IF p_action = 'approve' THEN
      UPDATE public.super_agent_claims SET status = 'finance_review', notes = v_existing_notes || CHR(10) || p_notes WHERE id = p_claim_id;
      UPDATE public.super_agent_commissions SET status = 'finance_review' WHERE super_agent_id = v_entity_id AND status = 'pending';
    ELSIF p_action = 'pay' THEN
      UPDATE public.super_agent_claims SET status = 'paid', paid_at = NOW(), notes = v_existing_notes || CHR(10) || p_notes WHERE id = p_claim_id;
      UPDATE public.super_agent_commissions SET status = 'paid' WHERE super_agent_id = v_entity_id AND status IN ('pending', 'finance_review');
    ELSIF p_action = 'reject' THEN
      UPDATE public.super_agent_claims SET status = 'rejected', notes = v_existing_notes || CHR(10) || p_notes WHERE id = p_claim_id;
      UPDATE public.super_agent_commissions SET status = 'unclaimed' WHERE super_agent_id = v_entity_id AND status IN ('pending', 'finance_review');
    END IF;
  END IF;
END;
$$;

-- Force purge ALL existing rogue commission triggers natively to guarantee mathematics execution
DO $$ 
DECLARE 
    r RECORD; 
BEGIN 
    FOR r IN (
        SELECT tgname FROM pg_trigger 
        WHERE tgrelid = 'public.members'::regclass 
        AND tgname ILIKE '%commission%'
        AND tgname != 'bind_marketer_commission_logic'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON public.members'; 
    END LOOP; 
END $$;
