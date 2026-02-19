-- Migration: 20260309000000_add_diagnosis_fields.sql
-- Description: Adds columns for separate diagnosis charting and locking mechanism.

-- 1. Add diagnosis-specific columns to dental_records
-- We keep 'status' for the overall state (e.g. if it has a procedure done), 
-- but 'condition' will track the specific biological condition (Decay, Missing, etc.)
ALTER TABLE public.dental_records
ADD COLUMN IF NOT EXISTS condition TEXT, -- e.g. 'decay', 'missing', 'filled', 'crowned', 'partial_denture'
ADD COLUMN IF NOT EXISTS color TEXT,     -- e.g. 'red', 'yellow', 'green', 'blue', 'pink'
ADD COLUMN IF NOT EXISTS diagnosed_at TIMESTAMP WITH TIME ZONE;

-- 2. Add locking mechanism to visits table
-- This timestamp indicates when the "Diagnosis Chart" was saved/locked.
-- If NULL, the visit is still in "Diagnosis Phase".
-- If SET, the visit is in "Treatment Phase".
ALTER TABLE public.visits
ADD COLUMN IF NOT EXISTS diagnosis_locked_at TIMESTAMP WITH TIME ZONE;

-- 3. Optional: Add an index on condition for analytics
CREATE INDEX IF NOT EXISTS idx_dental_records_condition ON public.dental_records(condition);
