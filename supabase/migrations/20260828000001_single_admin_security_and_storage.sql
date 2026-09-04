-- SRI SS GAS AGENCY Database Migration Schema (Incremental Security & Storage Update)
-- Migration: 20260828000001_single_admin_security_and_storage.sql
-- Description: Enforces single-admin authenticated security policies and provisions private storage bucket with Storage RLS.

-- 1. Private Storage Bucket Setup for Customer Documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-documents',
  'customer-documents',
  false, -- Strictly Private: Public direct access disabled
  10485760, -- 10 MB Max File Size Limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Storage Objects Row Level Security Policies
-- Enable RLS on storage objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing storage policies if present to ensure clean idempotent execution
DROP POLICY IF EXISTS "Authenticated Admin Storage Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Storage Access Denied" ON storage.objects;

-- Create policy allowing ONLY authenticated admin (auth.uid() IS NOT NULL) to manage storage objects in customer-documents bucket
CREATE POLICY "Authenticated Admin Storage Access"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'customer-documents' AND auth.uid() IS NOT NULL)
WITH CHECK (bucket_id = 'customer-documents' AND auth.uid() IS NOT NULL);

-- 3. Refine Table RLS Policies for Strict Single Admin Authenticated Verification
-- Ensure RLS is active on all core entity tables
ALTER TABLE IF EXISTS agency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cylinder_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cylinders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cylinder_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop legacy broad policies if present
DROP POLICY IF EXISTS "Admin full access agency_settings" ON agency_settings;
DROP POLICY IF EXISTS "Admin full access cylinder_types" ON cylinder_types;
DROP POLICY IF EXISTS "Admin full access customers" ON customers;
DROP POLICY IF EXISTS "Admin full access customer_documents" ON customer_documents;
DROP POLICY IF EXISTS "Admin full access cylinders" ON cylinders;
DROP POLICY IF EXISTS "Admin full access purchases" ON purchases;
DROP POLICY IF EXISTS "Admin full access purchase_items" ON purchase_items;
DROP POLICY IF EXISTS "Admin full access deposits" ON deposits;
DROP POLICY IF EXISTS "Admin full access payments" ON payments;
DROP POLICY IF EXISTS "Admin full access deliveries" ON deliveries;
DROP POLICY IF EXISTS "Admin full access delivery_items" ON delivery_items;
DROP POLICY IF EXISTS "Admin full access cylinder_movements" ON cylinder_movements;
DROP POLICY IF EXISTS "Admin full access audit_logs" ON audit_logs;

-- Re-create strict single-admin authenticated policies (verifying auth.uid() IS NOT NULL)
CREATE POLICY "Single Admin agency_settings" ON agency_settings FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Single Admin cylinder_types" ON cylinder_types FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Single Admin customers" ON customers FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Single Admin customer_documents" ON customer_documents FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Single Admin cylinders" ON cylinders FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Single Admin purchases" ON purchases FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Single Admin purchase_items" ON purchase_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Single Admin deposits" ON deposits FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Single Admin payments" ON payments FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Single Admin deliveries" ON deliveries FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Single Admin delivery_items" ON delivery_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Single Admin cylinder_movements" ON cylinder_movements FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Single Admin audit_logs" ON audit_logs FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
