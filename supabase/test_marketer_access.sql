-- Comprehensive test to verify marketer access
-- Run this while logged in as kenn@mail.com in the app

-- 1. Check current authenticated user
SELECT 
    'Current Auth User' as test,
    auth.uid() as current_user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as email;

-- 2. Try to select from marketers table as current user
SELECT 
    'Marketer Profile Query' as test,
    id,
    full_name,
    email,
    code,
    user_id
FROM public.marketers
WHERE user_id = auth.uid();

-- 3. Check all RLS policies on marketers table
SELECT 
    'RLS Policies' as test,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'marketers';

-- 4. Test if RLS is enabled
SELECT 
    'RLS Status' as test,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'marketers';

-- 5. Direct query to see if marketer exists (bypassing RLS for testing)
SET LOCAL ROLE postgres;
SELECT 
    'Direct Marketer Check' as test,
    m.id,
    m.full_name,
    m.email,
    m.user_id,
    au.email as auth_email
FROM public.marketers m
LEFT JOIN auth.users au ON au.id = m.user_id
WHERE m.email = 'kenn@mail.com';
RESET ROLE;
