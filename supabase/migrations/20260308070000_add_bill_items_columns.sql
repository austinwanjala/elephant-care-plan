-- Add missing columns to bill_items table
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC DEFAULT 0;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS tooth_number TEXT;
