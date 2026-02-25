-- Migration to fix dependants workflow and add site content management

-- 1. Update dependants table
ALTER TABLE public.dependants ADD COLUMN IF NOT EXISTS gender TEXT;

-- 2. Create site_content table
CREATE TABLE IF NOT EXISTS public.site_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 3. Create site_content_history table
CREATE TABLE IF NOT EXISTS public.site_content_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.site_content(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    content TEXT NOT NULL,
    version_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    version_by UUID REFERENCES auth.users(id)
);

-- 4. Enable RLS on site_content
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content_history ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for site_content
CREATE POLICY "Anyone can view site content" 
ON public.site_content FOR SELECT 
USING (true);

CREATE POLICY "Super admin can manage site content" 
ON public.site_content FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- 6. Insert initial slugs if not exists
INSERT INTO public.site_content (slug, content)
VALUES 
    ('terms_and_conditions', '<h1>Terms and Conditions</h1><p>Default terms...</p>'),
    ('privacy_policy', '<h1>Privacy Policy</h1><p>Default privacy policy...</p>')
ON CONFLICT (slug) DO NOTHING;

-- 7. Audit log function trigger (optional but good for Task 1)
-- We'll do the audit log entry manually in the frontend as requested or via trigger.
-- The user requested: Add an audit log entry: "dependant_added_via_registration"

-- 8. Add system_logs entries if they don't exist
-- No changes needed to system_logs table as it exists.
