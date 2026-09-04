-- SRI SS GAS AGENCY Database Migration Schema (Explicit Single-Admin Security Update)
-- Migration: 20260828000002_explicit_admin_security_policies.sql
-- Description: Restricts database and private Storage access strictly to the single authorized admin username ('srissgasagency' / 'srissgasagency@srissgas.com' or role 'admin').

-- 1. Create Hardened SECURITY DEFINER Admin Helper Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN (
    auth.uid() IS NOT NULL AND (
      LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'srissgasagency@srissgas.com' OR
      LOWER(SPLIT_PART(COALESCE(auth.jwt() ->> 'email', ''), '@', 1)) = 'srissgasagency' OR
      COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    )
  );
END;
$$;

-- 2. Storage Objects Row Level Security Policies
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop previous storage policies to ensure clean idempotent upgrade
DROP POLICY IF EXISTS "Authenticated Admin Storage Access" ON storage.objects;
DROP POLICY IF EXISTS "Single Admin Storage Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Storage Access Denied" ON storage.objects;

-- Create policy allowing ONLY the verified single admin (public.is_admin()) to access storage objects in customer-documents bucket
CREATE POLICY "Single Admin Storage Access"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'customer-documents' AND public.is_admin())
WITH CHECK (bucket_id = 'customer-documents' AND public.is_admin());

-- 3. Replace Table RLS Policies with Explicit Admin Verification
-- Drop broad / previous policies
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

DROP POLICY IF EXISTS "Single Admin agency_settings" ON agency_settings;
DROP POLICY IF EXISTS "Single Admin cylinder_types" ON cylinder_types;
DROP POLICY IF EXISTS "Single Admin customers" ON customers;
DROP POLICY IF EXISTS "Single Admin customer_documents" ON customer_documents;
DROP POLICY IF EXISTS "Single Admin cylinders" ON cylinders;
DROP POLICY IF EXISTS "Single Admin purchases" ON purchases;
DROP POLICY IF EXISTS "Single Admin purchase_items" ON purchase_items;
DROP POLICY IF EXISTS "Single Admin deposits" ON deposits;
DROP POLICY IF EXISTS "Single Admin payments" ON payments;
DROP POLICY IF EXISTS "Single Admin deliveries" ON deliveries;
DROP POLICY IF EXISTS "Single Admin delivery_items" ON delivery_items;
DROP POLICY IF EXISTS "Single Admin cylinder_movements" ON cylinder_movements;
DROP POLICY IF EXISTS "Single Admin audit_logs" ON audit_logs;

-- Re-create explicit single-admin policies using public.is_admin()
CREATE POLICY "Single Admin agency_settings" ON agency_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin cylinder_types" ON cylinder_types FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin customers" ON customers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin customer_documents" ON customer_documents FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin cylinders" ON cylinders FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin purchases" ON purchases FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin purchase_items" ON purchase_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin deposits" ON deposits FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin payments" ON payments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin deliveries" ON deliveries FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin delivery_items" ON delivery_items FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin cylinder_movements" ON cylinder_movements FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Single Admin audit_logs" ON audit_logs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
