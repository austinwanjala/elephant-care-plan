-- Migration: 20260308190000_permission_update_rpc.sql
-- Purpose: Provide a transactional RPC to update role_permissions, ensuring adds/removes happen atomically.

DROP FUNCTION IF EXISTS public.process_permission_updates(jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.process_permission_updates(
    p_adds JSONB,
    p_removes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item JSONB;
    v_removed_count INT := 0;
    v_added_count INT := 0;
BEGIN
    -- Check permissions
    IF NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'super_admin') THEN
        RAISE EXCEPTION 'Access Denied: Only admins can manage permissions.';
    END IF;

    -- 1. Process Removals
    IF p_removes IS NOT NULL AND jsonb_array_length(p_removes) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_removes)
        LOOP
            DELETE FROM public.role_permissions
            WHERE role = (item->>'role')::public.app_role
            AND permission_id = (item->>'permission_id')::uuid;
            
            IF FOUND THEN
                v_removed_count := v_removed_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- 2. Process Additions
    IF p_adds IS NOT NULL AND jsonb_array_length(p_adds) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_adds)
        LOOP
            INSERT INTO public.role_permissions (role, permission_id)
            VALUES (
                (item->>'role')::public.app_role,
                (item->>'permission_id')::uuid
            )
            ON CONFLICT (role, permission_id) DO NOTHING;
            
            IF FOUND THEN
                v_added_count := v_added_count + 1;
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('removed', v_removed_count, 'added', v_added_count);
END;
$$;
