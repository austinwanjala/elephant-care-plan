-- MIGRATION 1: Add new roles to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'doctor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'branch_director';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketer';