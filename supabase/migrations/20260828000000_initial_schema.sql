-- SRI SS GAS AGENCY Database Migration Schema
-- Version: 1.0.0
-- Created: 2026-08-28

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Code Generation Sequences & Functions
CREATE SEQUENCE IF NOT EXISTS customer_code_seq START WITH 1 INCREMENT BY 1;
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TEXT AS $$
BEGIN
  RETURN 'SSG-' || lpad(nextval('customer_code_seq')::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS purchase_code_seq START WITH 1 INCREMENT BY 1;
CREATE OR REPLACE FUNCTION generate_purchase_code()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PUR-' || lpad(nextval('purchase_code_seq')::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS delivery_code_seq START WITH 1 INCREMENT BY 1;
CREATE OR REPLACE FUNCTION generate_delivery_code()
RETURNS TEXT AS $$
BEGIN
  RETURN 'DEL-' || lpad(nextval('delivery_code_seq')::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Core Tables

-- Agency Settings Table
CREATE TABLE IF NOT EXISTS agency_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name TEXT NOT NULL DEFAULT 'SRI SS GAS AGENCY',
  subtitle TEXT NOT NULL DEFAULT 'Gas Agency Management System',
  phone TEXT NOT NULL DEFAULT '+91 9876543210',
  email TEXT NOT NULL DEFAULT 'contact@srissgas.com',
  address TEXT NOT NULL DEFAULT '123 Main Road, Salem, Tamil Nadu, India',
  default_price_5kg NUMERIC NOT NULL DEFAULT 450,
  default_price_12kg NUMERIC NOT NULL DEFAULT 950,
  default_price_17kg NUMERIC NOT NULL DEFAULT 1450,
  default_price_21kg NUMERIC NOT NULL DEFAULT 1850,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default agency settings record if empty
INSERT INTO agency_settings (agency_name, subtitle, phone, email, address, default_price_5kg, default_price_12kg, default_price_17kg, default_price_21kg)
SELECT 'SRI SS GAS AGENCY', 'Gas Agency Management System', '+91 9876543210', 'contact@srissgas.com', '123 Main Road, Salem, Tamil Nadu, India', 450, 950, 1450, 1850
WHERE NOT EXISTS (SELECT 1 FROM agency_settings);

-- Cylinder Types Table
CREATE TABLE IF NOT EXISTS cylinder_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  default_price NUMERIC NOT NULL DEFAULT 950,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial cylinder types: 5 kg, 12 kg, 17 kg, 21 kg
INSERT INTO cylinder_types (name, weight_kg, default_price)
VALUES 
  ('5 kg', 5, 450),
  ('12 kg', 12, 950),
  ('17 kg', 17, 1450),
  ('21 kg', 21, 1850)
ON CONFLICT (name) DO UPDATE SET default_price = EXCLUDED.default_price;

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
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
  city TEXT DEFAULT 'Salem',
  pincode TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer Documents Table (Private Storage metadata)
CREATE TABLE IF NOT EXISTS customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('aadhaar', 'other')),
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cylinders Serial Tracking Table
CREATE TABLE IF NOT EXISTS cylinders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cylinder_number TEXT UNIQUE NOT NULL,
  cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(id),
  status TEXT NOT NULL CHECK (status IN ('available', 'full', 'with_customer', 'empty', 'in_delivery', 'damaged', 'maintenance')),
  current_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_code TEXT UNIQUE NOT NULL DEFAULT generate_purchase_code(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_gas_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase Items Table
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC NOT NULL CHECK (total_price >= 0)
);

-- Deposits Table (Tracked separately from gas sales!)
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('given', 'held', 'adjusted', 'refunded')),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'other')),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments Table (Tracked separately)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'other')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('paid', 'partial', 'pending')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deliveries Table
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_code TEXT UNIQUE NOT NULL DEFAULT generate_delivery_code(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
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

-- Delivery Items Table
CREATE TABLE IF NOT EXISTS delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

-- Cylinder Movements History Table
CREATE TABLE IF NOT EXISTS cylinder_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cylinder_id UUID REFERENCES cylinders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('assigned', 'delivered', 'returned', 'marked_empty', 'marked_full', 'maintenance')),
  movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference_id UUID,
  notes TEXT,
  created_by UUID
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Database Indexes
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_area ON customers(area1);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);

CREATE INDEX IF NOT EXISTS idx_purchases_customer ON purchases(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_deposits_customer ON deposits(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer ON deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date);

CREATE INDEX IF NOT EXISTS idx_cylinders_status ON cylinders(status);
CREATE INDEX IF NOT EXISTS idx_cylinders_customer ON cylinders(current_customer_id);

-- 5. Row Level Security (RLS)
ALTER TABLE agency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cylinder_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cylinders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cylinder_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow full access to authenticated users (Single Admin Application)
CREATE POLICY "Admin full access agency_settings" ON agency_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access cylinder_types" ON cylinder_types FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access customer_documents" ON customer_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access cylinders" ON cylinders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access purchases" ON purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access purchase_items" ON purchase_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access deposits" ON deposits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access payments" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access deliveries" ON deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access delivery_items" ON delivery_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access cylinder_movements" ON cylinder_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access audit_logs" ON audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also create storage bucket setup instructions:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('customer-documents', 'customer-documents', false) ON CONFLICT (id) DO NOTHING;
