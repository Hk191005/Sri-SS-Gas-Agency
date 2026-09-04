-- SRI SS GAS AGENCY Database Migration Schema (UUID-Based Admin Authorization)
-- Migration: 20260828000003_uuid_admin_authorization.sql
-- Description: Updates public.is_admin() to enforce strict UUID-based authorization for the administrator identity.

-- 1. Create Single Admin Configuration Table
CREATE TABLE IF NOT EXISTS public.admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on admin_config table
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Single Admin Config Read" ON public.admin_config;
CREATE POLICY "Single Admin Config Read"
ON public.admin_config
FOR ALL
TO authenticated
USING (auth.uid() = admin_user_id)
WITH CHECK (auth.uid() = admin_user_id);

-- 2. Update Hardened SECURITY DEFINER Admin Verification Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_configured_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Primary Authorization: Compare auth.uid() against admin_config table
  SELECT admin_user_id INTO v_configured_id FROM public.admin_config LIMIT 1;
  IF v_configured_id IS NOT NULL THEN
    RETURN (auth.uid() = v_configured_id);
  END IF;

  -- 2. Fallback Authorization: Match auth.uid() against the admin user record in auth.users
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND LOWER(email) = 'srissgasagency@srissgas.com'
  );
END;
$$;
