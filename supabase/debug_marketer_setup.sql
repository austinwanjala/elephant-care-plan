-- Debug script to check marketer commission system setup
-- Run this in Supabase SQL Editor to verify everything is set up correctly

-- 1. Check if new tables exist
SELECT 
    'marketer_commission_config' as table_name,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'marketer_commission_config'
    ) as exists
UNION ALL
SELECT 
    'marketer_claims' as table_name,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'marketer_claims'
    ) as exists;

-- 2. Check if commission config has data
SELECT 'Commission Config' as check_type, COUNT(*) as count 
FROM public.marketer_commission_config;

-- 3. List all marketers
SELECT 'All Marketers' as check_type, id, full_name, email, code, is_active 
FROM public.marketers;

-- 4. Check user_roles for marketer role
SELECT 'Marketer Roles' as check_type, ur.user_id, au.email, ur.role
FROM public.user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE ur.role = 'marketer';
