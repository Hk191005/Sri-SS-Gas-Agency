-- SRI SS GAS AGENCY Database Migration Schema (Pure Singleton UUID Authorization)
-- Migration: 20260828000004_singleton_uuid_authorization.sql
-- Description: Enforces mathematically singleton admin_config table and pure UUID-based is_admin() authorization with ZERO fallbacks.

-- 1. Re-create admin_config as a strict Singleton table (id = 1 constraint)
DROP TABLE IF EXISTS public.admin_config CASCADE;

CREATE TABLE public.admin_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Hard singleton constraint: Only 1 row with id=1 can ever exist!
  admin_user_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on admin_config table
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- Read-only policy for authenticated admin. NO INSERT/UPDATE/DELETE policies for frontend API!
DROP POLICY IF EXISTS "Single Admin Config Select" ON public.admin_config;
CREATE POLICY "Single Admin Config Select"
ON public.admin_config
FOR SELECT
TO authenticated
USING (auth.uid() = admin_user_id);

-- 2. Pure UUID Authorization Function (Zero Fallbacks)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Fetch the single configured administrator UUID from singleton table (id = 1)
  SELECT admin_user_id INTO v_admin_id FROM public.admin_config WHERE id = 1;
  IF v_admin_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- PURE AUTHORIZATION: auth.uid() MUST EXACTLY EQUAL CONFIGURED ADMIN UUID
  RETURN (auth.uid() = v_admin_id);
END;
$$;
