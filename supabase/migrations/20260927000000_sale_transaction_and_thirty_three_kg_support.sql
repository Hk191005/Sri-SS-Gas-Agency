-- Migration: 20260927000000_sale_transaction_and_thirty_three_kg_support.sql
-- Description:
-- 1. Complete authoritative 33KG support in agency_settings (prices, deposits, reminders).
-- 2. Ensure 33KG cylinder type exists in cylinder_types table.
-- 3. Provide atomic, rollback-safe create_sale_transaction() RPC stored procedure with customer active validation.

-- ============================================================
-- 1. 33KG SETTINGS COLUMNS IN AGENCY_SETTINGS
-- ============================================================
ALTER TABLE agency_settings ADD COLUMN IF NOT EXISTS default_price_33kg NUMERIC(10,2) DEFAULT 4850.00;
ALTER TABLE agency_settings ADD COLUMN IF NOT EXISTS default_buying_price_33kg NUMERIC(10,2) DEFAULT 4500.00;
ALTER TABLE agency_settings ADD COLUMN IF NOT EXISTS default_deposit_33kg NUMERIC(10,2) DEFAULT 4000.00;
ALTER TABLE agency_settings ADD COLUMN IF NOT EXISTS reminder_interval_33kg INT DEFAULT 60;
ALTER TABLE agency_settings ADD COLUMN IF NOT EXISTS reminder_lead_days_33kg INT DEFAULT 5;

-- ============================================================
-- 2. ENSURE 33KG CYLINDER TYPE IN CYLINDER_TYPES
-- ============================================================
INSERT INTO cylinder_types (name, weight_kg, default_price, is_active)
SELECT '33KG', 33, 4850.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM cylinder_types WHERE weight_kg = 33 OR UPPER(name) = '33KG'
);

-- ============================================================
-- 3. ATOMIC SALE TRANSACTION RPC WITH CUSTOMER ACTIVE VALIDATION
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_sale_transaction(
  p_customer_id UUID,
  p_purchase_date DATE,
  p_items JSONB,
  p_deposit_amount NUMERIC DEFAULT NULL,
  p_deposit_payment_method TEXT DEFAULT NULL,
  p_payment_amount NUMERIC DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_delivery_status TEXT DEFAULT 'delivered',
  p_notes TEXT DEFAULT NULL,
  p_empty_return_quantity INT DEFAULT NULL,
  p_empty_return_type_id UUID DEFAULT NULL,
  p_empty_return_type_name TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer RECORD;
  v_purchase_id UUID;
  v_purchase_code TEXT;
  v_total_gas NUMERIC := 0;
  v_item JSONB;
  v_item_qty INT;
  v_item_unit_price NUMERIC;
  v_item_total NUMERIC;
  v_item_type_id UUID;
  v_address TEXT;
  v_combined_notes TEXT;
  v_empty_tag TEXT;
  v_delivery_id UUID;
  v_is_full_payment BOOLEAN;
BEGIN
  -- 1. Validate customer exists and is strictly active
  SELECT * INTO v_customer
  FROM customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found with ID %', p_customer_id;
  END IF;

  IF v_customer.is_active IS NOT TRUE OR v_customer.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Customer is inactive or archived. Cannot record sales for inactive customers.';
  END IF;

  -- 2. Validate items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one purchase item is required.';
  END IF;

  -- Calculate total gas amount
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_qty := COALESCE((v_item->>'quantity')::INT, 0);
    v_item_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0);
    IF v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero.';
    END IF;
    IF v_item_unit_price < 0 THEN
      RAISE EXCEPTION 'Item unit price cannot be negative.';
    END IF;
    v_total_gas := v_total_gas + (v_item_qty * v_item_unit_price);
  END LOOP;

  -- Prepare notes
  v_combined_notes := COALESCE(TRIM(p_notes), '');
  IF p_empty_return_quantity IS NOT NULL AND p_empty_return_quantity > 0 THEN
    v_empty_tag := 'Empty - ' || p_empty_return_quantity::TEXT || ' (' || UPPER(REPLACE(COALESCE(p_empty_return_type_name, '12KG'), ' ', '')) || ')';
    IF POSITION(v_empty_tag IN v_combined_notes) = 0 THEN
      IF LENGTH(v_combined_notes) > 0 THEN
        v_combined_notes := v_combined_notes || ' | ' || v_empty_tag;
      ELSE
        v_combined_notes := v_empty_tag;
      END IF;
    END IF;
  END IF;

  -- 3. Create purchase record
  INSERT INTO purchases (
    customer_id,
    purchase_date,
    total_gas_amount,
    notes,
    created_by
  ) VALUES (
    p_customer_id,
    p_purchase_date,
    v_total_gas,
    NULLIF(v_combined_notes, ''),
    p_user_id
  )
  RETURNING id, purchase_code INTO v_purchase_id, v_purchase_code;

  -- 4. Create purchase items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_qty := (v_item->>'quantity')::INT;
    v_item_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_item_type_id := (v_item->>'cylinder_type_id')::UUID;
    v_item_total := v_item_qty * v_item_unit_price;

    INSERT INTO purchase_items (
      purchase_id,
      cylinder_type_id,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_purchase_id,
      v_item_type_id,
      v_item_qty,
      v_item_unit_price,
      v_item_total
    );
  END LOOP;

  -- 5. Create deposit if applicable (liability, separate from sales revenue)
  IF p_deposit_amount IS NOT NULL AND p_deposit_amount > 0 THEN
    INSERT INTO deposits (
      customer_id,
      purchase_id,
      amount,
      status,
      payment_method,
      transaction_date,
      notes,
      created_by
    ) VALUES (
      p_customer_id,
      v_purchase_id,
      p_deposit_amount,
      'held',
      COALESCE(p_deposit_payment_method, 'cash'),
      p_purchase_date,
      'Deposit for purchase ' || v_purchase_code,
      p_user_id
    );
  END IF;

  -- 6. Create payment if applicable
  IF p_payment_amount IS NOT NULL AND p_payment_amount > 0 THEN
    v_is_full_payment := (p_payment_amount >= v_total_gas);
    INSERT INTO payments (
      customer_id,
      purchase_id,
      amount,
      payment_method,
      payment_date,
      status,
      notes,
      created_by
    ) VALUES (
      p_customer_id,
      v_purchase_id,
      p_payment_amount,
      COALESCE(p_payment_method, 'cash'),
      p_purchase_date,
      CASE WHEN v_is_full_payment THEN 'paid' ELSE 'partial' END,
      'Payment for purchase ' || v_purchase_code,
      p_user_id
    );
  END IF;

  -- 7. Create delivery record
  v_address := CONCAT_WS(', ', NULLIF(TRIM(v_customer.street), ''), NULLIF(TRIM(v_customer.area1), ''), NULLIF(TRIM(v_customer.area2), ''), NULLIF(TRIM(v_customer.city), ''));
  IF v_address IS NULL OR v_address = '' THEN
    v_address := 'Customer Delivery Address';
  END IF;

  INSERT INTO deliveries (
    customer_id,
    purchase_id,
    delivery_date,
    delivery_address,
    latitude,
    longitude,
    status,
    notes,
    created_by
  ) VALUES (
    p_customer_id,
    v_purchase_id,
    p_purchase_date,
    v_address,
    v_customer.latitude,
    v_customer.longitude,
    CASE WHEN p_delivery_status = 'delivered' THEN 'delivered' ELSE 'pending' END,
    'Delivery for purchase ' || v_purchase_code,
    p_user_id
  )
  RETURNING id INTO v_delivery_id;

  -- Insert delivery items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_qty := (v_item->>'quantity')::INT;
    v_item_type_id := (v_item->>'cylinder_type_id')::UUID;
    INSERT INTO delivery_items (
      delivery_id,
      cylinder_type_id,
      quantity
    ) VALUES (
      v_delivery_id,
      v_item_type_id,
      v_item_qty
    );
  END LOOP;

  -- 8. Record empty cylinder return movement if applicable
  IF p_empty_return_quantity IS NOT NULL AND p_empty_return_quantity > 0 THEN
    INSERT INTO cylinder_movements (
      customer_id,
      movement_type,
      movement_date,
      notes,
      created_by
    ) VALUES (
      p_customer_id,
      'returned',
      NOW(),
      'Returned ' || p_empty_return_quantity::TEXT || ' cylinders (' || COALESCE(p_empty_return_type_name, '12 kg') || '): Refill return for purchase ' || v_purchase_code,
      p_user_id
    );
  END IF;

  -- 9. Audit log entry
  INSERT INTO audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_user_id,
    'Purchase Created (Atomic RPC)',
    'purchases',
    v_purchase_id,
    jsonb_build_object(
      'code', v_purchase_code,
      'totalGas', v_total_gas,
      'deposit', p_deposit_amount,
      'payment', p_payment_amount,
      'emptyReturned', p_empty_return_quantity
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'purchase_code', v_purchase_code,
    'total_gas_amount', v_total_gas
  );
END;
$$;
