-- Check current user and their marketer profile
-- Run this while logged into the app to see your current user details

-- 1. Get current authenticated user
SELECT 
    'Current User' as info_type,
    auth.uid() as user_id,
    au.email,
    au.created_at
FROM auth.users au
WHERE au.id = auth.uid();

-- 2. Check if current user has a marketer profile
SELECT 
    'Marketer Profile' as info_type,
    m.id as marketer_id,
    m.full_name,
    m.code,
    m.is_active,
    m.total_earnings
FROM public.marketers m
WHERE m.user_id = auth.uid();

-- 3. Check current user's role
SELECT 
    'User Role' as info_type,
    ur.role,
    au.email
FROM public.user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE ur.user_id = auth.uid();

-- 4. Count referrals for current user (if they are a marketer)
SELECT 
    'Referral Count' as info_type,
    COUNT(*) as total_referrals,
    COUNT(*) FILTER (WHERE is_active = true) as active_referrals
FROM public.members
WHERE marketer_id IN (SELECT id FROM public.marketers WHERE user_id = auth.uid());

-- If all queries return empty results, you're not logged in as a marketer!
