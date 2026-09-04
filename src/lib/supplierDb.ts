/**
 * SRI SS GAS AGENCY — Supplier Purchases & Stock Inventory DB Logic
 * Handles company purchases (SUPERGAS, BPCL, etc.), bill extractions, payments, and stock inflows.
 */

import { supabase, isSupabaseConfigured, SupabaseNotConfiguredError } from './supabase';
import type { SupplierPurchase, SupplierPayment, SupplierCompany } from '../types/database.types';

function assertBackendAccess() {
  if (!isSupabaseConfigured()) {
    throw new SupabaseNotConfiguredError();
  }
}

/**
 * Fetch all supplier purchases
 */
export async function getSupplierPurchases(): Promise<SupplierPurchase[]> {
  assertBackendAccess();

  const { data, error } = await supabase
    .from('supplier_purchases')
    .select('*, items:supplier_purchase_items(*), payments:supplier_payments(*)')
    .order('invoice_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Check if invoice number already exists for a supplier
 */
export async function checkDuplicateInvoice(supplierName: string, invoiceNumber: string): Promise<boolean> {
  assertBackendAccess();

  const cleanInv = invoiceNumber.trim().toUpperCase();
  const cleanSupp = supplierName.trim().toUpperCase();

  const { data } = await supabase
    .from('supplier_purchases')
    .select('id')
    .ilike('supplier_name', cleanSupp)
    .ilike('invoice_number', cleanInv)
    .limit(1);

  return !!(data && data.length > 0);
}

/**
 * Create a new Supplier Purchase with line items
 */
export async function createSupplierPurchase(payload: {
  supplier_name: string;
  supplier_company_id?: string;
  purchase_source?: 'manual' | 'ocr_upload';
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid?: number;
  notes?: string;
  bill_storage_path?: string;
  status?: 'draft' | 'confirmed';
  items: Array<{
    cylinder_type_id: string;
    quantity: number;
    unit_price: number;
    tax_amount?: number;
    total_price: number;
  }>;
  extraction_info?: Record<string, any>;
}): Promise<SupplierPurchase> {
  assertBackendAccess();

  const status = payload.status || 'confirmed';
  const amountPaid = payload.amount_paid || 0;
  const outstanding = Math.max(0, payload.total_amount - amountPaid);
  const source = payload.purchase_source || (payload.bill_storage_path ? 'ocr_upload' : 'manual');

  try {
    // Generate code
    const { data: codeData } = await supabase.rpc('generate_supplier_purchase_code');
    const purchaseCode = codeData || `SPUR-${Date.now().toString().slice(-6)}`;

    // Get current user id
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id || null;

    const { data: purchase, error: pErr } = await supabase
      .from('supplier_purchases')
      .insert([
        {
          purchase_code: purchaseCode,
          supplier_name: payload.supplier_name,
          supplier_company_id: payload.supplier_company_id || null,
          purchase_source: source,
          invoice_number: payload.invoice_number,
          invoice_date: payload.invoice_date,
          subtotal: payload.subtotal,
          tax_amount: payload.tax_amount,
          total_amount: payload.total_amount,
          amount_paid: amountPaid,
          outstanding_amount: outstanding,
          status: status,
          bill_storage_path: payload.bill_storage_path,
          notes: payload.notes,
          created_by: userId,
        },
      ])
      .select()
      .single();

    if (pErr) throw new Error(pErr.message);

    // Insert Items
    if (payload.items && payload.items.length > 0) {
      const itemsToInsert = payload.items.map((it) => ({
        supplier_purchase_id: purchase.id,
        cylinder_type_id: it.cylinder_type_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        tax_amount: it.tax_amount || 0,
        total_price: it.total_price,
      }));

      const { error: itemErr } = await supabase.from('supplier_purchase_items').insert(itemsToInsert);
      if (itemErr) throw new Error(itemErr.message);
    }

    // Record initial payment if amount_paid > 0
    if (amountPaid > 0) {
      await supabase.from('supplier_payments').insert([
        {
          supplier_purchase_id: purchase.id,
          amount: amountPaid,
          payment_method: 'bank_transfer',
          payment_date: payload.invoice_date,
          notes: 'Initial payment recorded at invoice confirmation',
          created_by: userId,
        },
      ]);
    }

    // Save Extraction record
    if (payload.extraction_info) {
      await supabase.from('bill_extractions').insert([
        {
          supplier_purchase_id: purchase.id,
          extraction_status: 'completed',
          raw_extracted_data: payload.extraction_info,
          reviewed_data: payload,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        },
      ]);
    }

    // Audit log
    await supabase.from('audit_logs').insert([
      {
        user_id: userId,
        action: 'supplier_purchase_confirmed',
        entity_type: 'supplier_purchases',
        entity_id: purchase.id,
        metadata: { invoice_number: payload.invoice_number, total_amount: payload.total_amount, source },
      },
    ]);

    return purchase;
  } catch (err: any) {
    throw new Error('Supabase supplier purchase insertion failed: ' + err?.message);
  }
}

/**
 * Update an existing Supplier Purchase with line items (Atomic RPC)
 */
export async function updateSupplierPurchase(payload: {
  id: string;
  supplier_name: string;
  supplier_company_id?: string | null;
  invoice_number?: string;
  invoice_date: string;
  tax_amount?: number;
  notes?: string;
  items: Array<{
    cylinder_type_id: string;
    quantity: number;
    unit_price: number;
    tax_amount?: number;
    total_price: number;
  }>;
}): Promise<{ success: boolean; purchase_id: string; total_amount: number; outstanding_amount: number }> {
  assertBackendAccess();

  const { data, error } = await supabase.rpc('update_supplier_purchase', {
    p_purchase_id: payload.id,
    p_supplier_name: payload.supplier_name.trim(),
    p_supplier_company_id: payload.supplier_company_id || null,
    p_invoice_number: payload.invoice_number?.trim() || null,
    p_invoice_date: payload.invoice_date,
    p_tax_amount: payload.tax_amount || 0,
    p_notes: payload.notes || null,
    p_items: payload.items.map((it) => ({
      cylinder_type_id: it.cylinder_type_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      tax_amount: it.tax_amount || 0,
    })),
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Permanently delete a Supplier Purchase (Atomic RPC, blocks if payments exist)
 */
export async function deleteSupplierPurchase(purchaseId: string): Promise<{ success: boolean; deleted_purchase_id: string }> {
  assertBackendAccess();

  const { data, error } = await supabase.rpc('delete_supplier_purchase', {
    p_purchase_id: purchaseId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Cancel/void a Supplier Purchase (Used when payments exist)
 */
export async function cancelSupplierPurchase(purchaseId: string, reason?: string): Promise<{ success: boolean; purchase_id: string; status: string }> {
  assertBackendAccess();

  const { data, error } = await supabase.rpc('cancel_supplier_purchase', {
    p_purchase_id: purchaseId,
    p_reason: reason || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Record a payment against a Supplier Purchase
 */
export async function addSupplierPayment(payload: {
  supplier_purchase_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes?: string;
}): Promise<SupplierPayment> {
  assertBackendAccess();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;

  const { data: payment, error } = await supabase
    .from('supplier_payments')
    .insert([
      {
        supplier_purchase_id: payload.supplier_purchase_id,
        amount: payload.amount,
        payment_method: payload.payment_method,
        payment_date: payload.payment_date,
        notes: payload.notes,
        created_by: userId,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Fetch existing purchase
  const { data: pur } = await supabase
    .from('supplier_purchases')
    .select('amount_paid, total_amount')
    .eq('id', payload.supplier_purchase_id)
    .single();

  if (pur) {
    const newPaid = Number(pur.amount_paid || 0) + payload.amount;
    const newOutstanding = Math.max(0, Number(pur.total_amount || 0) - newPaid);
    await supabase
      .from('supplier_purchases')
      .update({ amount_paid: newPaid, outstanding_amount: newOutstanding, updated_at: new Date().toISOString() })
      .eq('id', payload.supplier_purchase_id);
  }

  return payment;
}

/**
 * Fetch all registered supplier companies
 */
export async function getSupplierCompanies(): Promise<SupplierCompany[]> {
  assertBackendAccess();

  const { data, error } = await supabase
    .from('supplier_companies')
    .select('*')
    .eq('is_active', true)
    .order('company_name');

  if (error) throw new Error('Failed to load supplier companies from Supabase: ' + error.message);
  return (data || []) as SupplierCompany[];
}

/**
 * Register a new supplier company
 */
export async function createSupplierCompany(payload: {
  company_name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
}): Promise<SupplierCompany> {
  assertBackendAccess();
  const cleanName = payload.company_name.trim();
  if (!cleanName) throw new Error('Supplier Company Name is required.');

  const { data, error } = await supabase
    .from('supplier_companies')
    .insert([
      {
        company_name: cleanName,
        contact_person: payload.contact_person?.trim() || null,
        phone: payload.phone?.trim() || null,
        email: payload.email?.trim() || null,
        address: payload.address?.trim() || null,
        gstin: payload.gstin?.trim() || null,
        is_active: true,
      },
    ])
    .select()
    .single();

  if (error) throw new Error('Failed to create supplier company in Supabase: ' + error.message);
  return data as SupplierCompany;
}

/**
 * Upload supplier bill to private storage
 */
export async function uploadSupplierBillFile(file: File): Promise<string> {
  assertBackendAccess();
  const fileExt = file.name.split('.').pop() || 'pdf';
  const cleanPath = `supplier_bills/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { error } = await supabase.storage.from('supplier-bills').upload(cleanPath, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    throw new Error('Failed to upload supplier bill file to storage: ' + error.message);
  }
  return cleanPath;
}
