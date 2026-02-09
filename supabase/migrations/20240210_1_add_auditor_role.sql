-- Add 'auditor' to app_role enum
-- We wrap in a transaction block which is default for migration runner if valid, 
-- or we rely on IF NOT EXISTS which is safe.
ALTER TYPE "public"."app_role" ADD VALUE IF NOT EXISTS 'auditor';
