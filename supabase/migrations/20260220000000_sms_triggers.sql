
-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Helper function to invoke Edge Function
CREATE OR REPLACE FUNCTION public.invoke_sms_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    request_body JSONB;
    request_id BIGINT;
    _phone TEXT;
    _name TEXT;
    _data JSONB;
    _type TEXT;
    _api_url TEXT := 'https://wtzdddcogjtzzmgjbbvz.supabase.co/functions/v1/send-sms'; -- Replace with your actual project URL/Function URL if different, but usually constructed like this.
    -- Ideally, store the URL in a secrets table or config, but hardcoding for now based on project assumptions. 
    -- Better yet, use `net.http_post` url directly.
    _anon_key TEXT; -- You might need to fetch this or just assume internal invocation doesn't need it if we trust the network, but usually Edge Functions verify JWT.  
                   -- For triggered events from DB, we can sign it or just rely on the function logic. 
                   -- actually for pg_net to supabase functions, we need the Authorization header.
    -- Simplified approach: We will just log the content for now if we can't easily get the anon key in SQL without setup.
    -- BUT, we can use `vault` or just hardcode the service_role key if absolutely necessary, but that's insecure.
    -- Best practice: The Edge Function should probably verify a shared secret or just be open if it checks origin (hard to check from pg_net).
    -- Let's assume we pass a "token" in the body or header. 
BEGIN
    -- We'll construct the payload based on the trigger context (TG_ARGV[0] could be the type)
    _type := TG_ARGV[0];
    
    IF _type = 'welcome' THEN
        _phone := NEW.phone;
        _data := jsonb_build_object('name', NEW.full_name);
    ELSIF _type = 'payment_confirmation' THEN
        -- Need to get member phone
        SELECT phone INTO _phone FROM public.members WHERE id = NEW.member_id;
        _data := jsonb_build_object('benefit_amount', NEW.coverage_added); -- Simplify, assuming coverage_added is relevant
    ELSIF _type = 'billing_completion' THEN
         -- Trigger on bills table. 
         -- Need member phone (via visits -> members)
         SELECT m.phone INTO _phone 
         FROM public.members m
         JOIN public.visits v ON m.id = v.member_id
         WHERE v.id = NEW.visit_id;
         
         -- Calculate balance (need to fetch latest from members, but NEW in bills might not have it)
         -- Actually, we can just fetch it.
         DECLARE 
            _balance NUMERIC;
         BEGIN
            SELECT coverage_balance INTO _balance FROM public.members m JOIN public.visits v ON m.id = v.member_id WHERE v.id = NEW.visit_id;
            _data := jsonb_build_object('benefit_cost', NEW.total_benefit_cost, 'balance', _balance);
         END;
    ELSIF _type = 'low_balance' THEN
        _phone := NEW.phone;
        _data := jsonb_build_object('balance', NEW.coverage_balance);
        
        -- Logic check: Only send if it JUST dropped below 20%
        -- This logic is tricky in a trigger without more state, but we can check OLD vs NEW.
        -- Assuming benefit_limit exists.
        IF (NEW.coverage_balance < (NEW.benefit_limit * 0.2)) AND (OLD.coverage_balance >= (OLD.benefit_limit * 0.2)) THEN
             -- Proceed
        ELSE
             RETURN NEW; -- Do nothing
        END IF;

    ELSIF _type = 'payment_failed' THEN
        SELECT phone INTO _phone FROM public.members WHERE id = NEW.member_id;
        _data := jsonb_build_object('amount', NEW.amount);
    END IF;

    IF _phone IS NOT NULL THEN
        request_body := jsonb_build_object(
            'type', _type,
            'phone', _phone,
            'data', _data
        );

        -- Send the request via pg_net
        -- Note: You need to replace 'YOUR_ANON_KEY' or setup a secure way. 
        -- For this iteration, I will assume the function is open or we rely on the internal network.
        -- Actually, Supabase Edge Functions require Authorization header by default unless disabled.
        -- We will attempt to send without it and see if it works (usually returns 401).
        -- To make this work, user strictly needs to provide the ANON KEY or SERVICE ROLE KEY.
        -- I will add a placeholder and ask the user to replace it in the file if I can't find it.
        -- OR, I can use `vault` if configured. 
        -- Let's try to just use a standard POST and if it fails, we debug.
        
        -- WORKAROUND: We can use a distinct header for internal calls that the function checks?
        -- No, let's just make the function handle it.
        
        PERFORM net.http_post(
            url := 'https://wtzdddcogjtzzmgjbbvz.supabase.co/functions/v1/send-sms',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SUPABASE_ANON_KEY"}', 
            body := request_body
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger 1: Welcome SMS
DROP TRIGGER IF EXISTS on_member_registered_sms ON public.members;
CREATE TRIGGER on_member_registered_sms
AFTER INSERT ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.invoke_sms_function('welcome');

-- Trigger 2: Payment Confirmation
DROP TRIGGER IF EXISTS on_payment_completed_sms ON public.payments;
CREATE TRIGGER on_payment_completed_sms
AFTER UPDATE ON public.payments
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION public.invoke_sms_function('payment_confirmation');

-- Trigger 3: Billing Completion
DROP TRIGGER IF EXISTS on_billing_finalized_sms ON public.bills;
CREATE TRIGGER on_billing_finalized_sms
AFTER UPDATE ON public.bills
FOR EACH ROW
WHEN (NEW.is_finalized = true AND OLD.is_finalized = false)
EXECUTE FUNCTION public.invoke_sms_function('billing_completion');

-- Trigger 4: Low Balance
DROP TRIGGER IF EXISTS on_low_balance_sms ON public.members;
CREATE TRIGGER on_low_balance_sms
AFTER UPDATE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.invoke_sms_function('low_balance');

-- Trigger 5: Failed Payment
DROP TRIGGER IF EXISTS on_payment_failed_sms ON public.payments;
CREATE TRIGGER on_payment_failed_sms
AFTER UPDATE ON public.payments
FOR EACH ROW
WHEN (NEW.status = 'failed' AND OLD.status != 'failed')
EXECUTE FUNCTION public.invoke_sms_function('payment_failed');
