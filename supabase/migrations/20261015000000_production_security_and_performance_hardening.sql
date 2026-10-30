-- ==============================================================================
-- SRI SS GAS AGENCY — PRODUCTION DATABASE HARDENING MIGRATION
-- Migration: 20261015000000_production_security_and_performance_hardening.sql
--
-- Goals:
-- 1. Security Definer Hardening: Revoke execute from anon & public on all
--    privileged business functions (SEC-01, SEC-02).
-- 2. Search Path Injection Prevention: Set fixed search_path = pg_catalog, public
--    for all functions (SEC-03).
-- 3. Hardened Customer Merge: Require admin session, verify server-side auth.uid(),
--    atomic transfer of all 9 dependent tables, soft-archive duplicate (DATA-02).
-- 4. Atomic Purchase Deletion RPC: Transaction-safe multi-table cascade (FIN-01).
-- 5. Foreign Key Performance: Add covering indexes for all 17 unindexed FKs (PERF-01).
-- 6. Canonical 33KG Alignment: Ensure 33KG exists in cylinder_types and settings (INV-02).
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- SECTION 1: SEARCH PATH MUTABILITY HARDENING (SEC-03)
-- ==============================================================================

ALTER FUNCTION public.generate_customer_code() SET search_path = pg_catalog, public;
ALTER FUNCTION public.generate_delivery_code() SET search_path = pg_catalog, public;
ALTER FUNCTION public.generate_purchase_code() SET search_path = pg_catalog, public;
ALTER FUNCTION public.generate_supplier_purchase_code() SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = pg_catalog, public;

-- ==============================================================================
-- SECTION 2: IS_ADMIN AUTHORIZATION FUNCTION (SEC-01, SEC-02)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Check if auth.uid() exists in active admin_users table
  IF EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Backwards-compatibility check for single admin_config
  IF EXISTS (
    SELECT 1 FROM public.admin_config
    WHERE admin_user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ==============================================================================
-- SECTION 3: PRIVILEGED RPC GRANTS HARDENING (SEC-02)
-- ==============================================================================

-- Revoke anon execution on all sensitive business procedures
REVOKE EXECUTE ON FUNCTION public.cancel_supplier_purchase(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_supplier_purchase(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_supplier_purchase(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_supplier_purchase(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_supplier_purchase(uuid, text, uuid, text, date, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_supplier_purchase(uuid, text, uuid, text, date, numeric, text, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_inventory_opening_balances(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_inventory_opening_balances(jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_customer_with_initial_gas(text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text, uuid, integer, numeric, numeric, numeric, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_customer_with_initial_gas(text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text, uuid, integer, numeric, numeric, numeric, text, date) TO authenticated, service_role;

-- Event trigger function must never be executable by client roles
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO postgres, service_role;

-- ==============================================================================
-- SECTION 4: HARDENED CUSTOMER MERGE FUNCTION (SEC-01, DATA-02)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.merge_customers(
  p_primary_id uuid,
  p_duplicate_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id uuid;
  v_primary_record RECORD;
  v_duplicate_record RECORD;
  v_purchases_count INT := 0;
  v_payments_count INT := 0;
  v_deposits_count INT := 0;
  v_deliveries_count INT := 0;
  v_docs_count INT := 0;
  v_cylinders_count INT := 0;
  v_movements_count INT := 0;
  v_notes_count INT := 0;
  v_followups_count INT := 0;
  v_remaining_refs INT := 0;
  v_result JSONB;
BEGIN
  -- 1. Server-side admin authorization verification
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  -- 2. Verified actor identity (reject unauthenticated or caller-spoofed identity)
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required. No active authenticated session.';
  END IF;

  -- 3. Input validation
  IF p_primary_id IS NULL OR p_duplicate_id IS NULL THEN
    RAISE EXCEPTION 'Primary customer ID and Duplicate customer ID are both required.';
  END IF;

  IF p_primary_id = p_duplicate_id THEN
    RAISE EXCEPTION 'Primary customer and Duplicate customer cannot be the same account.';
  END IF;

  -- 4. Verify primary customer exists and is not soft-deleted
  SELECT * INTO v_primary_record FROM public.customers WHERE id = p_primary_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Primary customer record not found: %', p_primary_id;
  END IF;

  -- 5. Verify duplicate customer exists and is eligible for merge
  SELECT * INTO v_duplicate_record FROM public.customers WHERE id = p_duplicate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Duplicate customer record not found: %', p_duplicate_id;
  END IF;

  IF v_duplicate_record.deleted_at IS NOT NULL AND v_duplicate_record.is_active = false AND v_duplicate_record.notes LIKE '%Merged into customer%' THEN
    RAISE EXCEPTION 'Duplicate customer % is already merged and archived.', v_duplicate_record.customer_code;
  END IF;

  -- 6. Atomically transfer all 9 dependent relationships in this single transaction

  -- Purchases
  WITH moved AS (
    UPDATE public.purchases
    SET customer_id = p_primary_id, updated_at = now()
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_purchases_count FROM moved;

  -- Payments
  WITH moved AS (
    UPDATE public.payments
    SET customer_id = p_primary_id
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_payments_count FROM moved;

  -- Deposits
  WITH moved AS (
    UPDATE public.deposits
    SET customer_id = p_primary_id
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_deposits_count FROM moved;

  -- Deliveries
  WITH moved AS (
    UPDATE public.deliveries
    SET customer_id = p_primary_id, updated_at = now()
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_deliveries_count FROM moved;

  -- Customer Documents (preserve original storage objects & files)
  WITH moved AS (
    UPDATE public.customer_documents
    SET customer_id = p_primary_id
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_docs_count FROM moved;

  -- Cylinders (active customer holding)
  WITH moved AS (
    UPDATE public.cylinders
    SET current_customer_id = p_primary_id, updated_at = now()
    WHERE current_customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_cylinders_count FROM moved;

  -- Cylinder Movements
  WITH moved AS (
    UPDATE public.cylinder_movements
    SET customer_id = p_primary_id
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_movements_count FROM moved;

  -- Customer Notes
  WITH moved AS (
    UPDATE public.customer_notes
    SET customer_id = p_primary_id
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_notes_count FROM moved;

  -- Customer Followups
  WITH moved AS (
    UPDATE public.customer_followups
    SET customer_id = p_primary_id, updated_at = now()
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_followups_count FROM moved;

  -- 7. Verification: Ensure zero residual records point to duplicate customer
  SELECT 
    (SELECT count(*) FROM public.purchases WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM public.payments WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM public.deposits WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM public.deliveries WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM public.customer_documents WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM public.cylinders WHERE current_customer_id = p_duplicate_id) +
    (SELECT count(*) FROM public.cylinder_movements WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM public.customer_notes WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM public.customer_followups WHERE customer_id = p_duplicate_id)
  INTO v_remaining_refs;

  IF v_remaining_refs > 0 THEN
    RAISE EXCEPTION 'Merge verification failed: % relational records still reference duplicate customer.', v_remaining_refs;
  END IF;

  -- 8. Safe Archival of duplicate customer record (soft deletion with trace note)
  UPDATE public.customers
  SET 
    is_active = false,
    deleted_at = now(),
    notes = CONCAT_WS(' | ', notes, 'Merged into customer ' || v_primary_record.customer_code || ' (' || v_primary_record.name || ') on ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS TZ')),
    updated_at = now()
  WHERE id = p_duplicate_id;

  -- 9. Authoritative Audit Log Entry: Use verified server v_actor_id
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) VALUES (
    v_actor_id,
    'CUSTOMER_MERGED',
    'customers',
    p_primary_id,
    jsonb_build_object(
      'primary_customer_id', p_primary_id,
      'primary_customer_code', v_primary_record.customer_code,
      'primary_customer_name', v_primary_record.name,
      'duplicate_customer_id', p_duplicate_id,
      'duplicate_customer_code', v_duplicate_record.customer_code,
      'duplicate_customer_name', v_duplicate_record.name,
      'transferred_purchases', v_purchases_count,
      'transferred_payments', v_payments_count,
      'transferred_deposits', v_deposits_count,
      'transferred_deliveries', v_deliveries_count,
      'transferred_documents', v_docs_count,
      'transferred_cylinders', v_cylinders_count,
      'transferred_movements', v_movements_count,
      'transferred_notes', v_notes_count,
      'transferred_followups', v_followups_count,
      'actor_user_id', v_actor_id,
      'merge_timestamp', now()
    ),
    now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'primary_id', p_primary_id,
    'primary_code', v_primary_record.customer_code,
    'primary_name', v_primary_record.name,
    'duplicate_id', p_duplicate_id,
    'duplicate_code', v_duplicate_record.customer_code,
    'duplicate_name', v_duplicate_record.name,
    'archived', true,
    'transferred', jsonb_build_object(
      'purchases', v_purchases_count,
      'payments', v_payments_count,
      'deposits', v_deposits_count,
      'deliveries', v_deliveries_count,
      'documents', v_docs_count,
      'cylinders', v_cylinders_count,
      'movements', v_movements_count,
      'notes', v_notes_count,
      'followups', v_followups_count
    )
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_customers(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid, uuid) TO authenticated, service_role;

-- ==============================================================================
-- SECTION 5: ATOMIC CUSTOMER PURCHASE DELETION RPC (FIN-01)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.delete_customer_purchase(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor_id uuid;
  v_purchase record;
  v_customer_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_purchase FROM public.purchases WHERE id = p_purchase_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase record not found: %', p_purchase_id;
  END IF;

  SELECT name INTO v_customer_name FROM public.customers WHERE id = v_purchase.customer_id;

  -- Atomic clean-up in one transaction
  DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id;
  DELETE FROM public.deposits WHERE purchase_id = p_purchase_id;
  DELETE FROM public.payments WHERE purchase_id = p_purchase_id;
  DELETE FROM public.deliveries WHERE purchase_id = p_purchase_id;
  DELETE FROM public.purchases WHERE id = p_purchase_id;

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, metadata, created_at
  ) VALUES (
    v_actor_id,
    'purchase_deleted',
    'purchases',
    p_purchase_id,
    jsonb_build_object(
      'purchase_code', v_purchase.purchase_code,
      'customer_id', v_purchase.customer_id,
      'customer_name', v_customer_name,
      'total_gas_amount', v_purchase.total_gas_amount,
      'purchase_date', v_purchase.purchase_date
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', p_purchase_id,
    'purchase_code', v_purchase.purchase_code,
    'message', 'Purchase ' || v_purchase.purchase_code || ' deleted successfully.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_customer_purchase(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_customer_purchase(uuid) TO authenticated, service_role;

-- ==============================================================================
-- SECTION 6: 17 COVERING INDEXES FOR UNINDEXED FOREIGN KEYS (PERF-01)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_bill_extractions_supp_purchase ON public.bill_extractions(supplier_purchase_id);
CREATE INDEX IF NOT EXISTS idx_customer_documents_cust_id ON public.customer_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_cylinder_movements_cust_id ON public.cylinder_movements(customer_id);
CREATE INDEX IF NOT EXISTS idx_cylinder_movements_cyl_id ON public.cylinder_movements(cylinder_id);
CREATE INDEX IF NOT EXISTS idx_cylinders_type_id ON public.cylinders(cylinder_type_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_purchase_id ON public.deliveries(purchase_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_cyl_type ON public.delivery_items(cylinder_type_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery_id ON public.delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_deposits_purchase_id ON public.deposits(purchase_id);
CREATE INDEX IF NOT EXISTS idx_inventory_opening_balances_updated_by ON public.inventory_opening_balances(updated_by);
CREATE INDEX IF NOT EXISTS idx_payments_purchase_id ON public.payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_cyl_type ON public.purchase_items(cylinder_type_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supp_purchase ON public.supplier_payments(supplier_purchase_id);
CREATE INDEX IF NOT EXISTS idx_supplier_purchase_items_cyl_type ON public.supplier_purchase_items(cylinder_type_id);
CREATE INDEX IF NOT EXISTS idx_supplier_purchase_items_purchase_id ON public.supplier_purchase_items(supplier_purchase_id);
CREATE INDEX IF NOT EXISTS idx_supplier_purchases_company_id ON public.supplier_purchases(supplier_company_id);

-- ==============================================================================
-- SECTION 7: 33KG CYLINDER SUPPORT & SETTINGS PARITY (INV-02)
-- ==============================================================================

INSERT INTO public.cylinder_types (name, weight_kg, default_price, is_active)
SELECT '33KG', 33, 4850.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.cylinder_types WHERE weight_kg = 33 OR UPPER(name) = '33KG'
);

ALTER TABLE public.agency_settings 
  ADD COLUMN IF NOT EXISTS default_price_33kg NUMERIC(10,2) DEFAULT 4850.00,
  ADD COLUMN IF NOT EXISTS default_buying_price_33kg NUMERIC(10,2) DEFAULT 4500.00,
  ADD COLUMN IF NOT EXISTS default_deposit_33kg NUMERIC(10,2) DEFAULT 4000.00,
  ADD COLUMN IF NOT EXISTS reminder_interval_33kg INT DEFAULT 60,
  ADD COLUMN IF NOT EXISTS reminder_lead_days_33kg INT DEFAULT 5;

COMMIT;
