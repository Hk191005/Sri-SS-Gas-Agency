-- Migration: 20260907000000_customer_renumber_merge_and_docs.sql
-- Description: 
-- 1. Safely renumber existing customer codes chronologically (SSG-000001..SSG-000037) based on created_at ASC.
-- 2. Update customer_code_seq to ensure next customer gets the next consecutive ID (SSG-000038).
-- 3. Expand customer_documents check constraint to support all common verification documents (Aadhaar, Address Proof, GST, PAN, Business Reg, License, Other).
-- 4. Create atomic, rollback-safe merge_customers() RPC stored procedure with verification and audit logging.

-- ============================================================
-- 1. SAFE SEQUENTIAL CUSTOMER ID RENUMBERING (COLLISION-PROOF)
-- ============================================================
DO $$
DECLARE
  v_count INT;
BEGIN
  -- Step 1: Assign temporary unique codes to prevent any unique constraint collision
  UPDATE customers
  SET customer_code = 'TEMP-' || id::text;

  -- Step 2: Assign final sequential SSG codes ordered by created_at ASC
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
    FROM customers
  )
  UPDATE customers c
  SET customer_code = 'SSG-' || lpad(r.row_num::text, 6, '0')
  FROM ranked r
  WHERE c.id = r.id;

  -- Step 3: Set customer_code_seq sequence value to the current customer count
  SELECT count(*) INTO v_count FROM customers;
  PERFORM setval('customer_code_seq', v_count, true);
END $$;

-- ============================================================
-- 2. EXPAND CUSTOMER_DOCUMENTS DOCUMENT_TYPE CONSTRAINT
-- ============================================================
DO $$
BEGIN
  -- Safely drop old restrictive check constraint
  ALTER TABLE customer_documents DROP CONSTRAINT IF EXISTS customer_documents_document_type_check;
  
  -- Add comprehensive document type check constraint
  ALTER TABLE customer_documents ADD CONSTRAINT customer_documents_document_type_check
    CHECK (document_type = ANY (ARRAY[
      'aadhaar'::text,
      'address_proof'::text,
      'gst'::text,
      'pan'::text,
      'business_reg'::text,
      'license'::text,
      'other'::text
    ]));
END $$;

-- ============================================================
-- 3. ATOMIC & ROLLBACK-SAFE MERGE CUSTOMERS STORED PROCEDURE
-- ============================================================
CREATE OR REPLACE FUNCTION merge_customers(
  p_primary_id UUID,
  p_duplicate_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
  -- 1. Validation
  IF p_primary_id IS NULL OR p_duplicate_id IS NULL THEN
    RAISE EXCEPTION 'Primary customer ID and Duplicate customer ID are both required.';
  END IF;

  IF p_primary_id = p_duplicate_id THEN
    RAISE EXCEPTION 'Primary customer and Duplicate customer cannot be the same account.';
  END IF;

  SELECT * INTO v_primary_record FROM customers WHERE id = p_primary_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Primary customer record not found: %', p_primary_id;
  END IF;

  SELECT * INTO v_duplicate_record FROM customers WHERE id = p_duplicate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Duplicate customer record not found: %', p_duplicate_id;
  END IF;

  -- 2. Transfer relationships atomically
  
  -- Purchases
  WITH moved AS (
    UPDATE purchases
    SET customer_id = p_primary_id, updated_at = now()
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_purchases_count FROM moved;

  -- Payments
  WITH moved AS (
    UPDATE payments
    SET customer_id = p_primary_id
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_payments_count FROM moved;

  -- Deposits
  WITH moved AS (
    UPDATE deposits
    SET customer_id = p_primary_id
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_deposits_count FROM moved;

  -- Deliveries
  WITH moved AS (
    UPDATE deliveries
    SET customer_id = p_primary_id, updated_at = now()
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_deliveries_count FROM moved;

  -- Customer Documents (preserve original storage objects & files)
  WITH moved AS (
    UPDATE customer_documents
    SET customer_id = p_primary_id
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_docs_count FROM moved;

  -- Cylinders (active customer holding)
  WITH moved AS (
    UPDATE cylinders
    SET current_customer_id = p_primary_id, updated_at = now()
    WHERE current_customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_cylinders_count FROM moved;

  -- Cylinder Movements
  WITH moved AS (
    UPDATE cylinder_movements
    SET customer_id = p_primary_id
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_movements_count FROM moved;

  -- Customer Notes
  WITH moved AS (
    UPDATE customer_notes
    SET customer_id = p_primary_id
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_notes_count FROM moved;

  -- Customer Followups
  WITH moved AS (
    UPDATE customer_followups
    SET customer_id = p_primary_id, updated_at = now()
    WHERE customer_id = p_duplicate_id
    RETURNING id
  )
  SELECT count(*) INTO v_followups_count FROM moved;

  -- 3. Verification: Ensure zero residual records point to duplicate customer
  SELECT 
    (SELECT count(*) FROM purchases WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM payments WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM deposits WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM deliveries WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM customer_documents WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM cylinders WHERE current_customer_id = p_duplicate_id) +
    (SELECT count(*) FROM cylinder_movements WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM customer_notes WHERE customer_id = p_duplicate_id) +
    (SELECT count(*) FROM customer_followups WHERE customer_id = p_duplicate_id)
  INTO v_remaining_refs;

  IF v_remaining_refs > 0 THEN
    RAISE EXCEPTION 'Merge verification failed: % relational records still reference duplicate customer.', v_remaining_refs;
  END IF;

  -- 4. Delete the duplicate customer record safely
  DELETE FROM customers WHERE id = p_duplicate_id;

  -- 5. Record Audit Log Entry: CUSTOMER_MERGED
  INSERT INTO audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
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
