-- =============================================================================
-- Migration: 20260325000000_xray_images_periodontal_stage_names.sql
-- Description:
--   1. Create xray_images table for structured X-ray record keeping
--   2. Add periodontal_status column to visits table
--   3. Add stage_names text[] column to services table (display-only, no logic impact)
--   4. RLS policies for xray_images (doctors + admin; members/directors excluded)
-- =============================================================================

-- ─────────────────────────────────────────────────
-- 1. xray_images table
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xray_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    dependant_id UUID REFERENCES public.dependants(id) ON DELETE SET NULL,
    visit_id    UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
    doctor_id   UUID NOT NULL REFERENCES public.staff(id) ON DELETE SET NULL,
    branch_id   UUID NOT NULL REFERENCES public.branches(id) ON DELETE SET NULL,
    image_url   TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.xray_images ENABLE ROW LEVEL SECURITY;

-- Doctors can insert their own records
CREATE POLICY "doctors_insert_xrays" ON public.xray_images
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('doctor', 'admin', 'super_admin')
        )
    );

-- Doctors, Admin, and Receptionists can view xrays.
-- Explicitly NOT members or branch_directors.
CREATE POLICY "staff_select_xrays" ON public.xray_images
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('doctor', 'admin', 'super_admin', 'receptionist')
        )
    );

-- ─────────────────────────────────────────────────
-- 2. periodontal_status on visits
-- ─────────────────────────────────────────────────
ALTER TABLE public.visits
    ADD COLUMN IF NOT EXISTS periodontal_status TEXT
    CHECK (periodontal_status IN ('periodontitis', 'staining', 'calculus', 'gingivitis'));

-- ─────────────────────────────────────────────────
-- 3. stage_names on services (display-only)
-- ─────────────────────────────────────────────────
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS stage_names TEXT[] DEFAULT '{}';

-- Index for analytics — does not affect logic
CREATE INDEX IF NOT EXISTS idx_xray_images_visit_id   ON public.xray_images(visit_id);
CREATE INDEX IF NOT EXISTS idx_xray_images_member_id  ON public.xray_images(member_id);
