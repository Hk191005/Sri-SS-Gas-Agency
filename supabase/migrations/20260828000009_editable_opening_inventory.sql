-- SRI SS GAS AGENCY Migration Schema
-- Migration: 20260828000009_editable_opening_inventory.sql
-- Editable Opening Inventory Configuration for 4kg, 12kg, 17kg, and 21kg cylinders

-- 1. Extend agency_settings with opening_stock columns
ALTER TABLE public.agency_settings
ADD COLUMN IF NOT EXISTS opening_stock_4kg INTEGER NOT NULL DEFAULT 40,
ADD COLUMN IF NOT EXISTS opening_stock_12kg INTEGER NOT NULL DEFAULT 150,
ADD COLUMN IF NOT EXISTS opening_stock_17kg INTEGER NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS opening_stock_21kg INTEGER NOT NULL DEFAULT 80;

-- 2. Add non-negative check constraints if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agency_settings_opening_stock_4kg_check'
  ) THEN
    ALTER TABLE public.agency_settings
    ADD CONSTRAINT agency_settings_opening_stock_4kg_check CHECK (opening_stock_4kg >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agency_settings_opening_stock_12kg_check'
  ) THEN
    ALTER TABLE public.agency_settings
    ADD CONSTRAINT agency_settings_opening_stock_12kg_check CHECK (opening_stock_12kg >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agency_settings_opening_stock_17kg_check'
  ) THEN
    ALTER TABLE public.agency_settings
    ADD CONSTRAINT agency_settings_opening_stock_17kg_check CHECK (opening_stock_17kg >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agency_settings_opening_stock_21kg_check'
  ) THEN
    ALTER TABLE public.agency_settings
    ADD CONSTRAINT agency_settings_opening_stock_21kg_check CHECK (opening_stock_21kg >= 0);
  END IF;
END $$;
