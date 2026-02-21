-- Migration: 20260310000001_whatsapp_triggers.sql
-- Description: Triggers to call WhatsApp API on key events.

CREATE OR REPLACE FUNCTION public.invoke_whatsapp_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    request_body JSONB;
    _phone TEXT;
    _name TEXT;
    _template TEXT;
    _data JSONB;
    _member_id UUID;
    _whatsapp_opt_in BOOLEAN;
BEGIN
    -- Determine target and payload
    IF TG_TABLE_NAME = 'members' THEN
        _member_id := NEW.id;
        _phone := NEW.phone;
        _name := NEW.full_name;
        _whatsapp_opt_in := NEW.whatsapp_opt_in;
        _template := 'member_welcome';
        _data := jsonb_build_object('name', _name);
    
    ELSIF TG_TABLE_NAME = 'payments' THEN
        SELECT id, phone, full_name, whatsapp_opt_in INTO _member_id, _phone, _name, _whatsapp_opt_in 
        FROM public.members WHERE id = NEW.member_id;
        
        IF NEW.status = 'completed' THEN
            _template := 'cover_activation';
            _data := jsonb_build_object('name', _name, 'balance', NEW.coverage_added);
        ELSIF NEW.status = 'failed' THEN
            _template := 'payment_failed';
            _data := jsonb_build_object('name', _name, 'amount', NEW.amount);
        END IF;

    ELSIF TG_TABLE_NAME = 'bills' THEN
        SELECT m.id, m.phone, m.full_name, m.whatsapp_opt_in, m.coverage_balance 
        INTO _member_id, _phone, _name, _whatsapp_opt_in, _data
        FROM public.members m
        JOIN public.visits v ON m.id = v.member_id
        WHERE v.id = NEW.visit_id;
        
        _template := 'billing_notification';
        -- _data from select is actually a bit messy here, let's rebuild
        _data := jsonb_build_object('cost', NEW.total_benefit_cost, 'balance', (SELECT coverage_balance FROM members WHERE id = _member_id));

    ELSIF TG_TABLE_NAME = 'service_stages' THEN
        SELECT id, phone, full_name, whatsapp_opt_in INTO _member_id, _phone, _name, _whatsapp_opt_in 
        FROM public.members WHERE id = NEW.member_id;
        
        _template := 'treatment_progress';
        _data := jsonb_build_object('current', NEW.current_stage, 'total', NEW.total_stages);
    END IF;

    -- ONLY proceed if opted in
    IF _phone IS NOT NULL AND _whatsapp_opt_in = TRUE AND _template IS NOT NULL THEN
        -- 1. Create Log Entry (Initial)
        INSERT INTO whatsapp_logs (member_id, type, phone, template_name, status)
        VALUES (_member_id, _template, _phone, _template, 'pending')
        RETURNING id INTO _member_id; -- Reusing variable for log_id

        request_body := jsonb_build_object(
            'phone', _phone,
            'template', _template,
            'data', _data,
            'log_id', _member_id
        );

        -- 2. Call Edge Function
        PERFORM net.http_post(
            url := 'https://wtzdddcogjtzzmgjbbvz.supabase.co/functions/v1/send-whatsapp',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SUPABASE_ANON_KEY"}', 
            body := request_body
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger: Welcome WhatsApp
DROP TRIGGER IF EXISTS on_member_registered_whatsapp ON public.members;
CREATE TRIGGER on_member_registered_whatsapp
AFTER INSERT ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.invoke_whatsapp_function();

-- Trigger: Payment WhatsApp
DROP TRIGGER IF EXISTS on_payment_status_whatsapp ON public.payments;
CREATE TRIGGER on_payment_status_whatsapp
AFTER UPDATE ON public.payments
FOR EACH ROW
WHEN (NEW.status != OLD.status)
EXECUTE FUNCTION public.invoke_whatsapp_function();

-- Trigger: Billing WhatsApp
DROP TRIGGER IF EXISTS on_billing_finalized_whatsapp ON public.bills;
CREATE TRIGGER on_billing_finalized_whatsapp
AFTER UPDATE ON public.bills
FOR EACH ROW
WHEN (NEW.is_finalized = true AND OLD.is_finalized = false)
EXECUTE FUNCTION public.invoke_whatsapp_function();

-- Trigger: Stage Progress WhatsApp
DROP TRIGGER IF EXISTS on_stage_update_whatsapp ON public.service_stages;
CREATE TRIGGER on_stage_update_whatsapp
AFTER INSERT OR UPDATE ON public.service_stages
FOR EACH ROW
EXECUTE FUNCTION public.invoke_whatsapp_function();
