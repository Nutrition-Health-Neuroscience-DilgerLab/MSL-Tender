-- ============================================
-- Fix Security Definer Views
-- ============================================
-- Issue: Views may have been created with SECURITY DEFINER property
-- which bypasses Row Level Security (RLS) policies
-- 
-- Solution: Recreate views with explicit SECURITY INVOKER
-- This ensures views use the querying user's permissions,
-- properly enforcing RLS policies on underlying tables
--
-- Date: December 31, 2025
-- Supabase Security Advisor Recommendation
-- ============================================

-- Step 1: Drop existing views
DROP VIEW IF EXISTS study_summary;
DROP VIEW IF EXISTS experiment_participation;

-- Step 2: Recreate study_summary view with SECURITY INVOKER
-- This view provides summary statistics per study
-- Uses querying user's permissions (respects RLS)
CREATE VIEW study_summary 
WITH (security_invoker=true) AS
SELECT 
    study_number,
    COUNT(*) as sample_count,
    ROUND(AVG(chop_color)::numeric, 2) as avg_color,
    ROUND(AVG(chop_marbling)::numeric, 2) as avg_marbling,
    ROUND(AVG(ph)::numeric, 2) as avg_ph,
    ROUND(AVG(moisture_percent)::numeric, 4) as avg_moisture,
    ROUND(AVG(fat_percent)::numeric, 4) as avg_fat
FROM pork_samples
GROUP BY study_number
ORDER BY study_number;

-- Step 3: Recreate experiment_participation view with SECURITY INVOKER
-- This view provides experiment participation and response statistics
-- Uses querying user's permissions (respects RLS)
CREATE VIEW experiment_participation 
WITH (security_invoker=true) AS
SELECT 
    e.id,
    e.name,
    e.status,
    COUNT(DISTINCT ps.id) as participant_count,
    COUNT(DISTINCT r.id) as response_count,
    ROUND(AVG(r.response_time_ms)::numeric, 0) as avg_response_time_ms
FROM experiments e
LEFT JOIN participant_sessions ps ON e.id = ps.experiment_id
LEFT JOIN responses r ON ps.id = r.session_id
GROUP BY e.id, e.name, e.status;

-- Step 4: Grant appropriate permissions
-- Public can view these views (RLS on underlying tables handles security)
GRANT SELECT ON study_summary TO anon, authenticated;
GRANT SELECT ON experiment_participation TO anon, authenticated;

-- ============================================
-- Verification Queries
-- ============================================

-- Verify views are created with security_invoker
SELECT 
    schemaname,
    viewname,
    viewowner
FROM pg_views 
WHERE viewname IN ('study_summary', 'experiment_participation')
AND schemaname = 'public';

-- Check view options (should show security_invoker=true)
SELECT 
    c.relname AS view_name,
    c.reloptions AS view_options
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
AND c.relname IN ('study_summary', 'experiment_participation')
AND n.nspname = 'public';

-- ============================================
-- Notes on SECURITY DEFINER vs SECURITY INVOKER
-- ============================================
--
-- SECURITY DEFINER (what we're removing):
--   - View executes with permissions of view CREATOR
--   - Bypasses Row Level Security (RLS) policies
--   - Can expose data that querying user shouldn't see
--   - Security risk for external-facing applications
--
-- SECURITY INVOKER (what we're adding):
--   - View executes with permissions of querying USER
--   - Respects Row Level Security (RLS) policies
--   - Users only see data they have permission to access
--   - Recommended for public/authenticated access
--
-- The is_admin() function remains SECURITY DEFINER because:
--   - It needs to check admin_users table
--   - It's used within RLS policies (not directly exposed)
--   - It's properly scoped to return boolean only
--
-- ============================================
