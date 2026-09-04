-- ==============================================================================
-- SRI SS GAS AGENCY — COMPLETE SINGLE-FILE BOOTSTRAP DATABASE MIGRATION
-- Project: CRM + Gas Agency Management System
-- Location: Tiruppur District, Tamil Nadu, India
-- Security Model: Supabase Auth + RLS via public.admin_users UUID authorization
-- Target: Fresh / Empty Supabase PostgreSQL Project
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SEQUENCES & CODE GENERATOR FUNCTIONS
CREATE SEQUENCE IF NOT EXISTS customer_code_seq START WITH 1 INCREMENT BY 1;
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'SSG-' || lpad(nextval('customer_code_seq')::text, 6, '0');
END;
$$;

CREATE SEQUENCE IF NOT EXISTS purchase_code_seq START WITH 1 INCREMENT BY 1;
CREATE OR REPLACE FUNCTION generate_purchase_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'PUR-' || lpad(nextval('purchase_code_seq')::text, 6, '0');
END;
$$;

CREATE SEQUENCE IF NOT EXISTS delivery_code_seq START WITH 1 INCREMENT BY 1;
CREATE OR REPLACE FUNCTION generate_delivery_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'DEL-' || lpad(nextval('delivery_code_seq')::text, 6, '0');
END;
$$;

CREATE SEQUENCE IF NOT EXISTS supplier_purchase_code_seq START WITH 1 INCREMENT BY 1;
CREATE OR REPLACE FUNCTION generate_supplier_purchase_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'SPUR-' || lpad(nextval('supplier_purchase_code_seq')::text, 6, '0');
END;
$$;

-- 3. CORE ALL 20 TABLES

-- 1) Admin Users Table (Stores authorized admin user UUIDs)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Legacy Single Admin Config Table (for backwards compatibility)
CREATE TABLE IF NOT EXISTS public.admin_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  admin_user_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Agency Settings Table
CREATE TABLE IF NOT EXISTS public.agency_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name TEXT NOT NULL DEFAULT 'SRI SS GAS AGENCY',
  subtitle TEXT NOT NULL DEFAULT 'Gas Agency Management System',
  phone TEXT NOT NULL DEFAULT '+91 9876543210',
  email TEXT NOT NULL DEFAULT 'contact@srissgas.com',
  address TEXT NOT NULL DEFAULT '123 Main Road, Tiruppur, Tamil Nadu, India',
  default_price_5kg NUMERIC NOT NULL DEFAULT 450,
  default_price_12kg NUMERIC NOT NULL DEFAULT 950,
  default_price_17kg NUMERIC NOT NULL DEFAULT 1450,
  default_price_21kg NUMERIC NOT NULL DEFAULT 1850,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial agency settings record if empty
INSERT INTO public.agency_settings (agency_name, subtitle, phone, email, address, default_price_5kg, default_price_12kg, default_price_17kg, default_price_21kg)
SELECT 'SRI SS GAS AGENCY', 'Gas Agency Management System', '+91 9876543210', 'contact@srissgas.com', '123 Main Road, Tiruppur, Tamil Nadu, India', 450, 950, 1450, 1850
WHERE NOT EXISTS (SELECT 1 FROM public.agency_settings);

-- 4) Cylinder Types Table
CREATE TABLE IF NOT EXISTS public.cylinder_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  default_price NUMERIC NOT NULL DEFAULT 950,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial cylinder types: 5 kg, 12 kg, 17 kg, 21 kg
INSERT INTO public.cylinder_types (name, weight_kg, default_price)
VALUES 
  ('5 kg', 5, 450),
  ('12 kg', 12, 950),
  ('17 kg', 17, 1450),
  ('21 kg', 21, 1850)
ON CONFLICT (name) DO UPDATE SET default_price = EXCLUDED.default_price;

-- 5) Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT UNIQUE NOT NULL DEFAULT generate_customer_code(),
  customer_type TEXT NOT NULL CHECK (customer_type IN ('individual', 'company')),
  name TEXT NOT NULL,
  company_name TEXT,
  contact_person_name TEXT,
  phone TEXT NOT NULL,
  alternate_phone TEXT,
  area1 TEXT,
  area2 TEXT,
  street TEXT,
  landmark TEXT,
  city TEXT DEFAULT 'Tiruppur',
  pincode TEXT,
  district TEXT DEFAULT 'Tiruppur',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6) Customer Documents Table (Private Storage Metadata)
CREATE TABLE IF NOT EXISTS public.customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('aadhaar', 'other')),
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) Customer Notes Table
CREATE TABLE IF NOT EXISTS public.customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by_name TEXT DEFAULT 'SRI SS Admin',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8) Customer Follow-Ups Table
CREATE TABLE IF NOT EXISTS public.customer_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('refill_30', 'important_60', 'critical_90', 'payment_outstanding')),
  status TEXT NOT NULL DEFAULT 'not_contacted' CHECK (status IN ('contacted', 'not_contacted', 'interested', 'will_purchase_later', 'no_response', 'completed')),
  days_inactive INTEGER DEFAULT 0,
  outstanding_amount NUMERIC(12,2) DEFAULT 0,
  last_purchase_date DATE,
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9) Cylinders Serial Tracking Table
CREATE TABLE IF NOT EXISTS public.cylinders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cylinder_number TEXT UNIQUE NOT NULL,
  cylinder_type_id UUID NOT NULL REFERENCES public.cylinder_types(id),
  status TEXT NOT NULL CHECK (status IN ('available', 'full', 'with_customer', 'empty', 'in_delivery', 'damaged', 'maintenance')),
  current_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10) Cylinder Movements History Table
CREATE TABLE IF NOT EXISTS public.cylinder_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cylinder_id UUID REFERENCES public.cylinders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('assigned', 'delivered', 'returned', 'marked_empty', 'marked_full', 'maintenance')),
  movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference_id UUID,
  notes TEXT,
  created_by UUID
);

-- 11) Purchases Table
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_code TEXT UNIQUE NOT NULL DEFAULT generate_purchase_code(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_gas_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12) Purchase Items Table
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  cylinder_type_id UUID NOT NULL REFERENCES public.cylinder_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC NOT NULL CHECK (total_price >= 0)
);

-- 13) Deposits Table
CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('given', 'held', 'adjusted', 'refunded')),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'other')),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14) Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'other')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('paid', 'partial', 'pending')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15) Deliveries Table
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_code TEXT UNIQUE NOT NULL DEFAULT generate_delivery_code(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT NOT NULL CHECK (status IN ('pending', 'assigned', 'out_for_delivery', 'delivered', 'cancelled')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16) Delivery Items Table
CREATE TABLE IF NOT EXISTS public.delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  cylinder_type_id UUID NOT NULL REFERENCES public.cylinder_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

-- 17) Supplier Purchases Table
CREATE TABLE IF NOT EXISTS public.supplier_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_code TEXT UNIQUE NOT NULL DEFAULT generate_supplier_purchase_code(),
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

-- 18) Supplier Purchase Items Table
CREATE TABLE IF NOT EXISTS public.supplier_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_purchase_id UUID NOT NULL REFERENCES public.supplier_purchases(id) ON DELETE CASCADE,
  cylinder_type_id UUID NOT NULL REFERENCES public.cylinder_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- 19) Supplier Payments Table
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

-- 20) Bill Extractions Table
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

-- 21) Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. DATABASE INDEXES FOR HIGH-PERFORMANCE SEARCH
CREATE INDEX IF NOT EXISTS idx_customers_code ON public.customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_type ON public.customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_area ON public.customers(area1);
CREATE INDEX IF NOT EXISTS idx_customers_active ON public.customers(is_active);

CREATE INDEX IF NOT EXISTS idx_purchases_customer ON public.purchases(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases(purchase_date);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_deposits_customer ON public.deposits(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer ON public.deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON public.deliveries(delivery_date);

CREATE INDEX IF NOT EXISTS idx_cylinders_status ON public.cylinders(status);
CREATE INDEX IF NOT EXISTS idx_cylinders_customer ON public.cylinders(current_customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON public.customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_followups_customer ON public.customer_followups(customer_id);
CREATE INDEX IF NOT EXISTS idx_supplier_purchases_code ON public.supplier_purchases(purchase_code);

-- 5. HARDENED SECURITY DEFINER AUTHORIZATION FUNCTION
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

-- 6. ROW LEVEL SECURITY (RLS) POLICIES FOR ALL TABLES

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cylinder_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cylinders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cylinder_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop previous policies to ensure clean idempotent script execution
DROP POLICY IF EXISTS "Admin access admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Admin access admin_config" ON public.admin_config;
DROP POLICY IF EXISTS "Admin access agency_settings" ON public.agency_settings;
DROP POLICY IF EXISTS "Admin access cylinder_types" ON public.cylinder_types;
DROP POLICY IF EXISTS "Admin access customers" ON public.customers;
DROP POLICY IF EXISTS "Admin access customer_documents" ON public.customer_documents;
DROP POLICY IF EXISTS "Admin access customer_notes" ON public.customer_notes;
DROP POLICY IF EXISTS "Admin access customer_followups" ON public.customer_followups;
DROP POLICY IF EXISTS "Admin access cylinders" ON public.cylinders;
DROP POLICY IF EXISTS "Admin access purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admin access purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Admin access deposits" ON public.deposits;
DROP POLICY IF EXISTS "Admin access payments" ON public.payments;
DROP POLICY IF EXISTS "Admin access deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Admin access delivery_items" ON public.delivery_items;
DROP POLICY IF EXISTS "Admin access cylinder_movements" ON public.cylinder_movements;
DROP POLICY IF EXISTS "Admin access supplier_purchases" ON public.supplier_purchases;
DROP POLICY IF EXISTS "Admin access supplier_purchase_items" ON public.supplier_purchase_items;
DROP POLICY IF EXISTS "Admin access supplier_payments" ON public.supplier_payments;
DROP POLICY IF EXISTS "Admin access bill_extractions" ON public.bill_extractions;
DROP POLICY IF EXISTS "Admin access audit_logs" ON public.audit_logs;

-- Create strict policies (Anonymous = ZERO access, Non-admin = ZERO access)
CREATE POLICY "Admin access admin_users" ON public.admin_users FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access admin_config" ON public.admin_config FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access agency_settings" ON public.agency_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access cylinder_types" ON public.cylinder_types FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access customers" ON public.customers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access customer_documents" ON public.customer_documents FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access customer_notes" ON public.customer_notes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access customer_followups" ON public.customer_followups FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access cylinders" ON public.cylinders FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access purchases" ON public.purchases FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access purchase_items" ON public.purchase_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access deposits" ON public.deposits FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access payments" ON public.payments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access deliveries" ON public.deliveries FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access delivery_items" ON public.delivery_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access cylinder_movements" ON public.cylinder_movements FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access supplier_purchases" ON public.supplier_purchases FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access supplier_purchase_items" ON public.supplier_purchase_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access supplier_payments" ON public.supplier_payments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access bill_extractions" ON public.bill_extractions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin access audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. SAFE PRIVATE STORAGE BUCKET PROVISIONING & STORAGE RLS POLICIES
-- NOTE: We DO NOT run `ALTER TABLE storage.objects` because Supabase system manages table ownership.
-- Supabase automatically enables RLS on storage.objects.

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'customer-documents',
    'customer-documents',
    false, -- Private bucket
    10485760, -- 10 MB Max limit
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
  )
  ON CONFLICT (id) DO UPDATE SET public = false;
EXCEPTION WHEN OTHERS THEN
  -- Safely ignore if storage extension permissions bypass direct SQL insert; bucket can also be created via Supabase Storage UI.
  RAISE NOTICE 'Storage bucket insert notice: Bucket creation can also be completed via Dashboard UI.';
END $$;

-- RLS Policy on Storage Objects for customer-documents bucket
DROP POLICY IF EXISTS "Authenticated Admin Storage Access" ON storage.objects;
DROP POLICY IF EXISTS "Single Admin Storage Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Storage Access customer-documents" ON storage.objects;

CREATE POLICY "Admin Storage Access customer-documents"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'customer-documents' AND public.is_admin())
WITH CHECK (bucket_id = 'customer-documents' AND public.is_admin());

-- 8. ATOMIC RPC FOR CUSTOMER & INITIAL GAS CREATION
CREATE OR REPLACE FUNCTION public.create_customer_with_initial_gas(
  p_customer_type TEXT,
  p_name TEXT,
  p_company_name TEXT DEFAULT NULL,
  p_contact_person_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_alternate_phone TEXT DEFAULT NULL,
  p_area1 TEXT DEFAULT NULL,
  p_area2 TEXT DEFAULT NULL,
  p_street TEXT DEFAULT NULL,
  p_landmark TEXT DEFAULT NULL,
  p_city TEXT DEFAULT 'Tiruppur',
  p_pincode TEXT DEFAULT NULL,
  p_district TEXT DEFAULT 'Tiruppur',
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
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
    v_customer_code, p_customer_type, p_name, p_company_name, p_contact_person_name,
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
        v_customer_id, v_purchase_id, p_deposit_amount, 'given', COALESCE(p_payment_method, 'cash'), p_purchase_date, 'Initial security deposit', v_creator_id
      );
    END IF;

    -- Payment record if provided
    IF p_payment_amount > 0 THEN
      INSERT INTO public.payments (
        customer_id, purchase_id, amount, payment_method, payment_date, status, notes, created_by
      ) VALUES (
        v_customer_id, v_purchase_id, p_payment_amount, COALESCE(p_payment_method, 'cash'), p_purchase_date,
        CASE WHEN p_payment_amount >= v_total_gas THEN 'paid' ELSE 'partial' END,
        'Initial gas payment', v_creator_id
      );
    END IF;

    -- Delivery record
    INSERT INTO public.deliveries (
      delivery_code, customer_id, purchase_id, delivery_date, delivery_address, status, created_by
    ) VALUES (
      generate_delivery_code(), v_customer_id, v_purchase_id, p_purchase_date,
      CONCAT_WS(', ', p_street, p_area1, p_area2, p_city, 'Tiruppur'), 'pending', v_creator_id
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

-- 9. REGISTER AUTHORIZED ADMINISTRATOR ACCOUNTS
-- Automatically inserts/enables the Owner and Father Supabase Auth accounts
INSERT INTO public.admin_users (user_id, email, full_name, is_active)
VALUES 
  ('f1ec0437-cf49-48b6-b0cb-9fac66455d2a', 'sshk5318@gmail.com', 'Owner Admin', true),
  ('6aa3b1a8-615a-4ec2-af92-1ec48e93f492', 'selvarajkm33@gmail.com', 'Father Admin', true)
ON CONFLICT (user_id) DO UPDATE 
SET email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    is_active = true;
