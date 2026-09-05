-- SRI SS GAS AGENCY Database Migration Schema
-- Migration: 20260828000010_inventory_opening_balances.sql
-- Description: Creates normalized inventory_opening_balances table, audit triggers, RLS policies, and atomic update RPC function.

-- 1. Create inventory_opening_balances Table
CREATE TABLE IF NOT EXISTS public.inventory_opening_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cylinder_type_id UUID NOT NULL REFERENCES public.cylinder_types(id) ON DELETE CASCADE,
  opening_full_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES auth.users(id),
  CONSTRAINT check_opening_full_quantity_non_negative CHECK (opening_full_quantity >= 0),
  CONSTRAINT unique_inventory_opening_cylinder_type UNIQUE (cylinder_type_id)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_opening_balances_cylinder_type_id
  ON public.inventory_opening_balances(cylinder_type_id);

-- 3. Trigger for updated_at
DROP TRIGGER IF EXISTS update_inventory_opening_balances_updated_at ON public.inventory_opening_balances;
CREATE TRIGGER update_inventory_opening_balances_updated_at
  BEFORE UPDATE ON public.inventory_opening_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Enable RLS & Define Policies
ALTER TABLE public.inventory_opening_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated Admin select inventory_opening_balances" ON public.inventory_opening_balances;
CREATE POLICY "Authenticated Admin select inventory_opening_balances"
  ON public.inventory_opening_balances
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated Admin insert inventory_opening_balances" ON public.inventory_opening_balances;
CREATE POLICY "Authenticated Admin insert inventory_opening_balances"
  ON public.inventory_opening_balances
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated Admin update inventory_opening_balances" ON public.inventory_opening_balances;
CREATE POLICY "Authenticated Admin update inventory_opening_balances"
  ON public.inventory_opening_balances
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated Admin delete inventory_opening_balances" ON public.inventory_opening_balances;
CREATE POLICY "Authenticated Admin delete inventory_opening_balances"
  ON public.inventory_opening_balances
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 5. Populate Initial Opening Stock for Existing Four Cylinder Types
INSERT INTO public.inventory_opening_balances (cylinder_type_id, opening_full_quantity)
SELECT id, 
  CASE 
    WHEN ROUND(weight_kg) = 4 THEN 40
    WHEN ROUND(weight_kg) = 12 THEN 150
    WHEN ROUND(weight_kg) = 17 THEN 60
    WHEN ROUND(weight_kg) = 21 THEN 80
    ELSE 0
  END
FROM public.cylinder_types
ON CONFLICT (cylinder_type_id) DO NOTHING;

-- 6. Atomic Save RPC Function
CREATE OR REPLACE FUNCTION public.update_inventory_opening_balances(p_balances jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item jsonb;
  v_type_id uuid;
  v_quantity integer;
  v_old_quantity integer;
  v_type_name text;
  v_result jsonb := '[]'::jsonb;
  v_updated_row public.inventory_opening_balances%ROWTYPE;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only active administrators can update opening inventory balances.';
  END IF;

  -- 2. Validate input array
  IF jsonb_typeof(p_balances) <> 'array' OR jsonb_array_length(p_balances) = 0 THEN
    RAISE EXCEPTION 'Invalid payload: Expected a non-empty array of balance updates.';
  END IF;

  -- 3. Loop and process each item atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_balances)
  LOOP
    v_type_id := (v_item ->> 'cylinder_type_id')::uuid;
    v_quantity := (v_item ->> 'opening_full_quantity')::integer;

    IF v_type_id IS NULL THEN
      RAISE EXCEPTION 'cylinder_type_id cannot be null.';
    END IF;

    IF v_quantity IS NULL OR v_quantity < 0 THEN
      RAISE EXCEPTION 'opening_full_quantity must be a non-negative integer for cylinder type %.', v_type_id;
    END IF;

    -- Verify cylinder type exists
    SELECT name INTO v_type_name FROM public.cylinder_types WHERE id = v_type_id;
    IF v_type_name IS NULL THEN
      RAISE EXCEPTION 'Cylinder type ID % does not exist.', v_type_id;
    END IF;

    -- Get old quantity for audit log
    SELECT opening_full_quantity INTO v_old_quantity
    FROM public.inventory_opening_balances
    WHERE cylinder_type_id = v_type_id;

    -- Insert or Update
    INSERT INTO public.inventory_opening_balances (cylinder_type_id, opening_full_quantity, updated_by, updated_at)
    VALUES (v_type_id, v_quantity, auth.uid(), now())
    ON CONFLICT (cylinder_type_id)
    DO UPDATE SET
      opening_full_quantity = EXCLUDED.opening_full_quantity,
      updated_by = auth.uid(),
      updated_at = now()
    RETURNING * INTO v_updated_row;

    -- Record Audit Log if quantity changed or newly inserted
    IF v_old_quantity IS DISTINCT FROM v_quantity THEN
      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (
        auth.uid(),
        'opening_stock_updated',
        'inventory_opening_balances',
        v_updated_row.id,
        jsonb_build_object(
          'cylinder_type_id', v_type_id,
          'cylinder_type_name', v_type_name,
          'previous_opening_quantity', COALESCE(v_old_quantity, 0),
          'new_opening_quantity', v_quantity
        ),
        now()
      );
    END IF;

    v_result := v_result || to_jsonb(v_updated_row);
  END LOOP;

  RETURN v_result;
END;
$$;
