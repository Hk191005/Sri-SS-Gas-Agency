-- SRI SS GAS AGENCY Migration Schema
-- Migration: 20260828000006_production_business_data_upgrade.sql
-- Real-World Business Pricing, Supplier Companies, Customer Deletion & PDF Audit

-- 1. Extend agency_settings with Selling Prices, Buying Prices, and Deposits
ALTER TABLE public.agency_settings
ADD COLUMN IF NOT EXISTS default_buying_price_5kg NUMERIC NOT NULL DEFAULT 600,
ADD COLUMN IF NOT EXISTS default_buying_price_12kg NUMERIC NOT NULL DEFAULT 1625,
ADD COLUMN IF NOT EXISTS default_buying_price_17kg NUMERIC NOT NULL DEFAULT 2380,
ADD COLUMN IF NOT EXISTS default_buying_price_21kg NUMERIC NOT NULL DEFAULT 2940,
ADD COLUMN IF NOT EXISTS default_deposit_5kg NUMERIC NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS default_deposit_12kg NUMERIC NOT NULL DEFAULT 2000,
ADD COLUMN IF NOT EXISTS default_deposit_17kg NUMERIC NOT NULL DEFAULT 2500,
ADD COLUMN IF NOT EXISTS default_deposit_21kg NUMERIC NOT NULL DEFAULT 3000;

-- Update default selling prices to current operational values
ALTER TABLE public.agency_settings
ALTER COLUMN default_price_5kg SET DEFAULT 650,
ALTER COLUMN default_price_12kg SET DEFAULT 1700,
ALTER COLUMN default_price_17kg SET DEFAULT 2552,
ALTER COLUMN default_price_21kg SET DEFAULT 3152;

-- 2. Soft-delete support for customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers(deleted_at);

-- RLS Policy for Customer Deletion
DROP POLICY IF EXISTS "Admin delete customers" ON public.customers;
CREATE POLICY "Admin delete customers"
ON public.customers FOR DELETE TO authenticated
USING (public.is_admin());

-- 3. Supplier Companies Table
CREATE TABLE IF NOT EXISTS public.supplier_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL UNIQUE,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  gstin TEXT,
  supplier_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin access supplier_companies" ON public.supplier_companies;
CREATE POLICY "Admin access supplier_companies"
ON public.supplier_companies FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed default supplier company
INSERT INTO public.supplier_companies (company_name, contact_person, phone, email, address)
VALUES ('SUPERGAS', 'Plant Logistics Manager', '+91 9876500000', 'orders@supergas.com', 'Tiruppur Industrial Supply Plant, Tamil Nadu')
ON CONFLICT (company_name) DO NOTHING;
