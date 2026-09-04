-- SRI SS GAS AGENCY Migration Schema
-- Migration: 20260828000007_four_kg_and_supplier_manual_entry.sql
-- 4 KG Canonical First Cylinder & Manual Supplier Purchase Integration

-- 1. Extend agency_settings with 4kg canonical pricing and deposit columns
ALTER TABLE public.agency_settings
ADD COLUMN IF NOT EXISTS default_price_4kg NUMERIC NOT NULL DEFAULT 650,
ADD COLUMN IF NOT EXISTS default_buying_price_4kg NUMERIC NOT NULL DEFAULT 600,
ADD COLUMN IF NOT EXISTS default_deposit_4kg NUMERIC NOT NULL DEFAULT 1000;

-- Copy existing 5kg values if they were previously configured, otherwise use verified business defaults
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'agency_settings' AND column_name = 'default_price_5kg'
  ) THEN
    UPDATE public.agency_settings 
    SET 
      default_price_4kg = COALESCE(default_price_5kg, 650),
      default_buying_price_4kg = COALESCE(default_buying_price_5kg, 600),
      default_deposit_4kg = COALESCE(default_deposit_5kg, 1000);
  END IF;
END $$;

-- 2. Update cylinder_types: convert any 5 kg record to canonical 4 kg Domestic
UPDATE public.cylinder_types
SET name = '4 kg', weight_kg = 4, default_price = 650, default_buying_price = 600, default_deposit = 1000
WHERE weight_kg = 5 OR name ILIKE '%5%kg%' OR id = 'ct-5kg';

-- Insert canonical 4 kg cylinder if not exists
INSERT INTO public.cylinder_types (id, name, weight_kg, default_price, default_buying_price, default_deposit, is_active)
SELECT 'ct-4kg', '4 kg', 4, 650, 600, 1000, true
WHERE NOT EXISTS (SELECT 1 FROM public.cylinder_types WHERE weight_kg = 4 OR name = '4 kg');

-- 3. Extend supplier_purchases for source tracking (manual vs ocr_upload) and supplier company relationship
ALTER TABLE public.supplier_purchases
ADD COLUMN IF NOT EXISTS purchase_source VARCHAR(20) NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS supplier_company_id UUID REFERENCES public.supplier_companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_purchases_company ON public.supplier_purchases(supplier_company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_purchases_source ON public.supplier_purchases(purchase_source);

-- Mark past records with bill storage or extraction info as ocr_upload
UPDATE public.supplier_purchases
SET purchase_source = 'ocr_upload'
WHERE bill_storage_path IS NOT NULL OR purchase_source IS NULL;
