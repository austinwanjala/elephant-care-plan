-- Add multi-stage configuration to services table
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS is_multi_stage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS total_stages INTEGER DEFAULT 1;

-- Create service_stages table to track patient progress
CREATE TABLE IF NOT EXISTS public.service_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id),
    member_id UUID NOT NULL REFERENCES public.members(id),
    dependant_id UUID REFERENCES public.dependants(id),
    visit_id UUID REFERENCES public.visits(id), -- The visit where the current stage was updated/performed
    current_stage INTEGER DEFAULT 1,
    total_stages INTEGER NOT NULL,
    status TEXT CHECK (status IN ('in_progress', 'completed')) DEFAULT 'in_progress',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast lookup of active stages during consultation
CREATE INDEX IF NOT EXISTS idx_service_stages_patient 
ON public.service_stages(member_id, service_id) 
WHERE status = 'in_progress';

-- Add RLS policies
ALTER TABLE public.service_stages ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users (staff)
CREATE POLICY "Allow read access for authenticated users" 
ON public.service_stages FOR SELECT 
TO authenticated 
USING (true);

-- Allow insert/update for staff (doctors/admins)
CREATE POLICY "Allow insert/update for staff" 
ON public.service_stages FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
