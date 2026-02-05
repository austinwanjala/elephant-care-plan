-- Check existing marketers and link kenn@mail.com to existing profile
-- Run this in Supabase SQL Editor

-- Step 1: Show all existing marketers
SELECT 
    'Existing Marketers' as info,
    id,
    full_name,
    email,
    code,
    user_id,
    is_active
FROM public.marketers
ORDER BY created_at DESC;

-- Step 2: Check if kenn@mail.com user exists in auth
SELECT 
    'Auth User' as info,
    id as user_id,
    email,
    created_at
FROM auth.users
WHERE email = 'kenn@mail.com';

-- Step 3: If there's a marketer with email kenn@mail.com but wrong user_id, update it
-- Otherwise, show which marketer profile should be linked
SELECT 
    'Marketer with kenn@mail.com email' as info,
    id,
    full_name,
    email,
    code,
    user_id as current_user_id,
    (SELECT id FROM auth.users WHERE email = 'kenn@mail.com') as correct_user_id
FROM public.marketers
WHERE email = 'kenn@mail.com';
