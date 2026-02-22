-- Migration: 20260311000000_portal_enhancements.sql
-- Description: Adds clinical enhancements and messaging system

-- 1. Add periodontal status and X-ray storage to visits
ALTER TABLE public.visits 
ADD COLUMN IF NOT EXISTS periodontal_status TEXT CHECK (periodontal_status IN ('staining', 'calculus', 'periodontitis')),
ADD COLUMN IF NOT EXISTS xray_urls TEXT[] DEFAULT '{}';

-- 2. Create portal_messages table for staff communication
CREATE TABLE IF NOT EXISTS public.portal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.staff(id),
    recipient_id UUID REFERENCES public.staff(id), -- Null for broadcast/general or if we want to support group/role channels
    branch_id UUID REFERENCES public.branches(id), -- Optional: target specific branch
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Add RLS for portal_messages
ALTER TABLE public.portal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view messages sent to them or by them" ON public.portal_messages
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND (id = sender_id OR id = recipient_id))
    OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Staff can send messages" ON public.portal_messages
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND id = sender_id)
);

-- 4. Create storage bucket for X-rays (if not exists via RPC/Supabase UI preference, but we can try to define)
-- Note: Bucket creation isn't typically done in SQL but we can ensure the visits table is ready.
