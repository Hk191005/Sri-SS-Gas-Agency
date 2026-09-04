-- SRI SS GAS AGENCY Migration Schema (Production Upgrade & Supplier Purchases)
-- Migration: 20260828000005_production_upgrade.sql

-- 1. Multi-Admin Users Table
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users viewable by authenticated admins" ON public.admin_users;
CREATE POLICY "Admin users viewable by authenticated admins"
ON public.admin_users FOR SELECT TO authenticated
USING (public.is_admin());

-- 2. Update public.is_admin() to support multiple configured admin UUIDs
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
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

  -- 2. Fallback: check legacy single admin_config table
  IF EXISTS (
    SELECT 1 FROM public.admin_config
    WHERE admin_user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 3. Ensure district column exists in customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS district TEXT DEFAULT 'Tiruppur';

-- 4. Supplier / Stock Purchases Schema
CREATE TABLE IF NOT EXISTS public.supplier_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_code TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL DEFAULT 'SUPERGAS',
  invoice_number TEXT NOT NULL,
  CONSTRAINT supplier_invoice_unique UNIQUE (supplier_name, invoice_number),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  outstanding_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  bill_storage_path TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_purchase_id UUID NOT NULL REFERENCES public.supplier_purchases(id) ON DELETE CASCADE,
  cylinder_type_id UUID NOT NULL REFERENCES public.cylinder_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_purchase_id UUID NOT NULL REFERENCES public.supplier_purchases(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bill_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_purchase_id UUID REFERENCES public.supplier_purchases(id) ON DELETE CASCADE,
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'completed', 'manual', 'failed')),
  raw_extracted_data JSONB,
  reviewed_data JSONB,
  confidence NUMERIC(5,2),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on supplier tables
ALTER TABLE public.supplier_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Single Admin supplier_purchases" ON public.supplier_purchases FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin supplier_purchase_items" ON public.supplier_purchase_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin supplier_payments" ON public.supplier_payments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin bill_extractions" ON public.bill_extractions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. Sequence generator for Supplier Purchase code (SPUR-000001)
CREATE SEQUENCE IF NOT EXISTS supplier_purchase_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_supplier_purchase_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  next_val INT;
BEGIN
  SELECT nextval('supplier_purchase_code_seq') INTO next_val;
  RETURN 'SPUR-' || LPAD(next_val::TEXT, 6, '0');
END;
$$;

-- 6. Atomic RPC Function to Create Customer + Initial Gas Details
CREATE OR REPLACE FUNCTION public.create_customer_with_initial_gas(
  p_customer_type TEXT,
  p_name TEXT,
  p_company_name TEXT,
  p_contact_person_name TEXT,
  p_phone TEXT,
  p_alternate_phone TEXT,
  p_area1 TEXT,
  p_area2 TEXT,
  p_street TEXT,
  p_landmark TEXT,
  p_city TEXT,
  p_pincode TEXT,
  p_district TEXT,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_notes TEXT,
  -- Initial gas params
  p_cylinder_type_id UUID DEFAULT NULL,
  p_quantity INTEGER DEFAULT 0,
  p_unit_price NUMERIC DEFAULT 0,
  p_deposit_amount NUMERIC DEFAULT 0,
  p_payment_amount NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'cash',
  p_purchase_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_customer_id UUID;
  v_customer_code TEXT;
  v_purchase_id UUID;
  v_purchase_code TEXT;
  v_total_gas NUMERIC;
  v_creator_id UUID;
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  v_creator_id := auth.uid();
  v_customer_code := generate_customer_code();
  
  -- 1. Create Customer
  INSERT INTO public.customers (
    customer_code, customer_type, name, company_name, contact_person_name,
    phone, alternate_phone, area1, area2, street, landmark, city, pincode, district,
    latitude, longitude, notes, is_active
  ) VALUES (
    v_customer_code, p_customer_type::customer_type, p_name, p_company_name, p_contact_person_name,
    p_phone, p_alternate_phone, p_area1, p_area2, p_street, p_landmark, COALESCE(p_city, 'Tiruppur'), p_pincode, COALESCE(p_district, 'Tiruppur'),
    p_latitude, p_longitude, p_notes, true
  )
  RETURNING id INTO v_customer_id;

  -- 2. If Initial Gas details provided, create purchase, deposit, payment, and delivery
  IF p_cylinder_type_id IS NOT NULL AND p_quantity > 0 THEN
    v_purchase_code := generate_purchase_code();
    v_total_gas := p_quantity * p_unit_price;

    INSERT INTO public.purchases (
      purchase_code, customer_id, purchase_date, total_gas_amount, notes, created_by
    ) VALUES (
      v_purchase_code, v_customer_id, p_purchase_date, v_total_gas, 'Initial customer registration purchase', v_creator_id
    )
    RETURNING id INTO v_purchase_id;

    INSERT INTO public.purchase_items (
      purchase_id, cylinder_type_id, quantity, unit_price, total_price
    ) VALUES (
      v_purchase_id, p_cylinder_type_id, p_quantity, p_unit_price, v_total_gas
    );

    -- Deposit record if provided
    IF p_deposit_amount > 0 THEN
      INSERT INTO public.deposits (
        customer_id, purchase_id, amount, status, payment_method, transaction_date, notes, created_by
      ) VALUES (
        v_customer_id, v_purchase_id, p_deposit_amount, 'given'::deposit_status, p_payment_method::payment_method, p_purchase_date, 'Initial security deposit', v_creator_id
      );
    END IF;

    -- Payment record if provided
    IF p_payment_amount > 0 THEN
      INSERT INTO public.payments (
        customer_id, purchase_id, amount, payment_method, payment_date, status, notes, created_by
      ) VALUES (
        v_customer_id, v_purchase_id, p_payment_amount, p_payment_method::payment_method, p_purchase_date,
        CASE WHEN p_payment_amount >= v_total_gas THEN 'paid'::payment_status ELSE 'partial'::payment_status END,
        'Initial gas payment', v_creator_id
      );
    END IF;

    -- Delivery record
    INSERT INTO public.deliveries (
      delivery_code, customer_id, purchase_id, delivery_date, delivery_address, status, created_by
    ) VALUES (
      generate_delivery_code(), v_customer_id, v_purchase_id, p_purchase_date,
      CONCAT_WS(', ', p_street, p_area1, p_area2, p_city, 'Tiruppur'), 'pending'::delivery_status, v_creator_id
    );
  END IF;

  -- 3. Log Audit
  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_creator_id, 'customer_created_with_initial_gas', 'customers', v_customer_id,
    jsonb_build_object('customer_code', v_customer_code, 'has_initial_gas', (p_quantity > 0))
  );

  v_result := jsonb_build_object(
    'customer_id', v_customer_id,
    'customer_code', v_customer_code,
    'purchase_id', v_purchase_id
  );

  RETURN v_result;
END;
$$;
