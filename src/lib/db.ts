import { supabase, isSupabaseConfigured, SupabaseNotConfiguredError } from './supabase';
import { getSupplierPurchases } from './supplierDb';
import type {
  Customer,
  CustomerType,
  DocumentType,
  CustomerDocument,
  Cylinder,
  CylinderType,
  CylinderStatus,
  Purchase,
  Deposit,
  Payment,
  Delivery,
  DeliveryStatus,
  AuditLog,
  AgencySettings,
  DashboardStats,
  CylinderStockSummary,
  InventoryOpeningBalance,
  CustomerNote,
  ActivityTimelineItem,
  CylinderFinancialDefaults,
} from '../types/database.types';

// Default initial Agency Settings
export const DEFAULT_AGENCY_SETTINGS: AgencySettings = {
  id: 'a0000000-0000-4000-8000-000000000001',
  agency_name: 'SRI SS GAS AGENCY',
  subtitle: 'Gas Agency Management System',
  phone: '+91 9876543210',
  email: 'contact@srissgas.com',
  address: 'Tiruppur District, Tamil Nadu, India',
  // Selling Prices (Customer Refill)
  default_price_4kg: 650,
  default_price_12kg: 1700,
  default_price_17kg: 2552,
  default_price_21kg: 3152,
  // Buying Prices (Supplier Stock Acquisition)
  default_buying_price_4kg: 600,
  default_buying_price_12kg: 1625,
  default_buying_price_17kg: 2380,
  default_buying_price_21kg: 2940,
  // Security Deposits (Held Cylinder Liability)
  default_deposit_4kg: 1000,
  default_deposit_12kg: 2000,
  default_deposit_17kg: 2500,
  default_deposit_21kg: 3000,
  // Refill Reminder Rules
  reminder_auto_enabled: true,
  reminder_interval_4kg: 14,
  reminder_interval_12kg: 30,
  reminder_interval_17kg: 60,
  reminder_interval_21kg: 60,
  reminder_lead_days_4kg: 2,
  reminder_lead_days_12kg: 3,
  reminder_lead_days_17kg: 5,
  reminder_lead_days_21kg: 5,
  // Legacy alias (read-only from existing database column)
  default_price_5kg: 650,
};

// Helper resolution functions for authoritative cylinder types
export function findCylinderTypeByWeight(types: CylinderType[], weightKg: number): CylinderType | undefined {
  return types.find((t) => Math.round(t.weight_kg) === Math.round(weightKg));
}

export function resolveCylinderTypeId(types: CylinderType[], input?: string | number | null): string {
  if (!types || types.length === 0) return '';
  if (!input) return types[0]?.id || '';
  if (typeof input === 'string' && isValidUUID(input)) {
    const found = types.find((t) => t.id === input);
    if (found) return found.id;
  }
  const str = String(input).toLowerCase();
  const weightNum = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (!isNaN(weightNum)) {
    const found = types.find((t) => Math.round(t.weight_kg) === Math.round(weightNum));
    if (found) return found.id;
  }
  const byName = types.find((t) => t.name.toLowerCase().includes(str));
  if (byName) return byName.id;
  return types[0]?.id || '';
}

function assertBackendAccess(): void {
  if (!isSupabaseConfigured()) {
    throw new SupabaseNotConfiguredError();
  }
}

// Helper: Check for valid UUID format
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUUID(id?: string | null): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * Authoritative helper: returns the default selling (refill) price for a cylinder weight.
 */
export function getDefaultPriceForWeight(weightKg: number, settings: AgencySettings): number {
  switch (Math.round(weightKg)) {
    case 4:
    case 5: // Legacy fallback mapped to canonical 4 kg
      return settings.default_price_4kg ?? settings.default_price_5kg ?? 650;
    case 12:
      return settings.default_price_12kg ?? 1700;
    case 17:
      return settings.default_price_17kg ?? 2552;
    case 21:
      return settings.default_price_21kg ?? 3152;
    default:
      return 1700;
  }
}

/**
 * Authoritative helper: returns the default buying (acquisition) price for a cylinder weight.
 */
export function getDefaultBuyingPriceForWeight(weightKg: number, settings: AgencySettings): number {
  switch (Math.round(weightKg)) {
    case 4:
    case 5: // Legacy fallback mapped to canonical 4 kg
      return settings.default_buying_price_4kg ?? 600;
    case 12:
      return settings.default_buying_price_12kg ?? 1625;
    case 17:
      return settings.default_buying_price_17kg ?? 2380;
    case 21:
      return settings.default_buying_price_21kg ?? 2940;
    default:
      return 1625;
  }
}

/**
 * Authoritative helper: returns the default security deposit for a cylinder weight.
 */
export function getDefaultDepositForWeight(weightKg: number, settings: AgencySettings): number {
  switch (Math.round(weightKg)) {
    case 4:
    case 5: // Legacy fallback mapped to canonical 4 kg
      return settings.default_deposit_4kg ?? 1000;
    case 12:
      return settings.default_deposit_12kg ?? 2000;
    case 17:
      return settings.default_deposit_17kg ?? 2500;
    case 21:
      return settings.default_deposit_21kg ?? 3000;
    default:
      return 2000;
  }
}

// -------------------------------------------------------------
// AGENCY SETTINGS & AUTHORITATIVE CYLINDER PRICING
// -------------------------------------------------------------

/**
 * Retrieves the single authoritative agency settings row from Supabase.
 */
export async function getAgencySettings(): Promise<AgencySettings> {
  assertBackendAccess();

  // Safe single-row resolution using limit(1)
  const { data, error } = await supabase.from('agency_settings').select('*').limit(1);
  if (!error && data && data.length > 0) {
    return data[0] as AgencySettings;
  }

  // If table exists but has no row, safely initialize with defaults
  if (!error && (!data || data.length === 0)) {
    const { data: inserted, error: insErr } = await supabase
      .from('agency_settings')
      .insert({
        agency_name: 'SRI SS GAS AGENCY',
        subtitle: 'Gas Agency Management System',
        phone: '+91 9876543210',
        email: 'contact@srissgas.com',
        address: 'Tiruppur District, Tamil Nadu, India',
        default_price_4kg: 650,
        default_price_12kg: 1700,
        default_price_17kg: 2552,
        default_price_21kg: 3152,
        default_buying_price_4kg: 600,
        default_buying_price_12kg: 1625,
        default_buying_price_17kg: 2380,
        default_buying_price_21kg: 2940,
        default_deposit_4kg: 1000,
        default_deposit_12kg: 2000,
        default_deposit_17kg: 2500,
        default_deposit_21kg: 3000,
      })
      .select()
      .single();
    if (!insErr && inserted) return inserted as AgencySettings;
    if (insErr) {
      console.error('Supabase initial agency_settings insert failed:', insErr.message);
    }
  }
  if (error) {
    console.error('Supabase getAgencySettings failed:', error.message);
  }

  return DEFAULT_AGENCY_SETTINGS;
}

/**
 * Persists updated agency settings, selling prices, buying prices, and deposits to Supabase.
 */
export async function updateAgencySettings(settings: Partial<AgencySettings>): Promise<AgencySettings> {
  assertBackendAccess();

  // Validate numeric fields (>= 0 and finite numbers)
  const validated: Partial<AgencySettings> = { ...settings };
  const numericFields: Array<keyof AgencySettings> = [
    'default_price_4kg',
    'default_price_12kg',
    'default_price_17kg',
    'default_price_21kg',
    'default_buying_price_4kg',
    'default_buying_price_12kg',
    'default_buying_price_17kg',
    'default_buying_price_21kg',
    'default_deposit_4kg',
    'default_deposit_12kg',
    'default_deposit_17kg',
    'default_deposit_21kg',
    'default_price_5kg', // Real column in Postgres schema, kept for legacy compatibility
  ];

  for (const field of numericFields) {
    if (validated[field] !== undefined) {
      const val = Number(validated[field]);
      if (isNaN(val) || !isFinite(val) || val < 0) {
        throw new Error(`Pricing/Deposit value for ${field} must be a valid non-negative number.`);
      }
      (validated as any)[field] = val;
    }
  }

  // Ensure 4kg and legacy 5kg selling price fields are harmonized
  if (validated.default_price_4kg !== undefined) {
    validated.default_price_5kg = validated.default_price_4kg;
  } else if (validated.default_price_5kg !== undefined) {
    validated.default_price_4kg = validated.default_price_5kg;
  }

  // 1. Resolve real target primary key UUID without assuming frontend strings
  let targetId = isValidUUID(validated.id) ? validated.id : undefined;
  if (!targetId) {
    const { data: existingRows, error: exErr } = await supabase.from('agency_settings').select('id').limit(1);
    if (!exErr && existingRows && existingRows.length > 0 && isValidUUID(existingRows[0].id)) {
      targetId = existingRows[0].id;
    }
  }

  let updatedRecord: AgencySettings;

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (validated.agency_name !== undefined) updatePayload.agency_name = validated.agency_name.trim();
  if (validated.subtitle !== undefined) updatePayload.subtitle = validated.subtitle.trim();
  if (validated.phone !== undefined) updatePayload.phone = validated.phone.trim();
  if (validated.email !== undefined) updatePayload.email = validated.email.trim();
  if (validated.address !== undefined) updatePayload.address = validated.address.trim();

  for (const field of numericFields) {
    if (validated[field] !== undefined) {
      updatePayload[field] = validated[field];
    }
  }

  const reminderFields: Array<keyof AgencySettings> = [
    'reminder_auto_enabled',
    'reminder_interval_4kg',
    'reminder_interval_12kg',
    'reminder_interval_17kg',
    'reminder_interval_21kg',
    'reminder_lead_days_4kg',
    'reminder_lead_days_12kg',
    'reminder_lead_days_17kg',
    'reminder_lead_days_21kg',
  ];
  for (const field of reminderFields) {
    if (validated[field] !== undefined) {
      updatePayload[field] = validated[field];
    }
  }

  if (targetId) {
    const { data, error } = await supabase
      .from('agency_settings')
      .update(updatePayload)
      .eq('id', targetId)
      .select()
      .single();
    if (error) throw new Error('Supabase update agency settings failed: ' + error.message);
    updatedRecord = data as AgencySettings;
  } else {
    const { data, error } = await supabase
      .from('agency_settings')
      .insert({
        agency_name: updatePayload.agency_name || 'SRI SS GAS AGENCY',
        subtitle: updatePayload.subtitle || 'Gas Agency Management System',
        phone: updatePayload.phone || '+91 9876543210',
        email: updatePayload.email || 'contact@srissgas.com',
        address: updatePayload.address || 'Tiruppur District, Tamil Nadu, India',
        default_price_4kg: updatePayload.default_price_4kg ?? updatePayload.default_price_5kg ?? 650,
        default_price_12kg: updatePayload.default_price_12kg ?? 1700,
        default_price_17kg: updatePayload.default_price_17kg ?? 2552,
        default_price_21kg: updatePayload.default_price_21kg ?? 3152,
        default_buying_price_4kg: updatePayload.default_buying_price_4kg ?? 600,
        default_buying_price_12kg: updatePayload.default_buying_price_12kg ?? 1625,
        default_buying_price_17kg: updatePayload.default_buying_price_17kg ?? 2380,
        default_buying_price_21kg: updatePayload.default_buying_price_21kg ?? 2940,
        default_deposit_4kg: updatePayload.default_deposit_4kg ?? 1000,
        default_deposit_12kg: updatePayload.default_deposit_12kg ?? 2000,
        default_deposit_17kg: updatePayload.default_deposit_17kg ?? 2500,
        default_deposit_21kg: updatePayload.default_deposit_21kg ?? 3000,
        ...updatePayload,
      })
      .select()
      .single();
    if (error) throw new Error('Supabase insert agency settings failed: ' + error.message);
    updatedRecord = data as AgencySettings;
  }

  // 2. Sync to cylinder_types table by weight_kg
  try {
    const weightSyncMap: Record<number, { price?: number; buyingPrice?: number; deposit?: number }> = {
      4: {
        price: updatedRecord.default_price_4kg ?? updatedRecord.default_price_5kg,
        buyingPrice: updatedRecord.default_buying_price_4kg,
        deposit: updatedRecord.default_deposit_4kg,
      },
      12: {
        price: updatedRecord.default_price_12kg,
        buyingPrice: updatedRecord.default_buying_price_12kg,
        deposit: updatedRecord.default_deposit_12kg,
      },
      17: {
        price: updatedRecord.default_price_17kg,
        buyingPrice: updatedRecord.default_buying_price_17kg,
        deposit: updatedRecord.default_deposit_17kg,
      },
      21: {
        price: updatedRecord.default_price_21kg,
        buyingPrice: updatedRecord.default_buying_price_21kg,
        deposit: updatedRecord.default_deposit_21kg,
      },
    };

    for (const [weightStr, values] of Object.entries(weightSyncMap)) {
      const payload: Record<string, any> = {};
      if (values.price !== undefined) payload.default_price = values.price;
      if (values.buyingPrice !== undefined) payload.default_buying_price = values.buyingPrice;
      if (values.deposit !== undefined) payload.default_deposit = values.deposit;
      if (Object.keys(payload).length > 0) {
        await supabase
          .from('cylinder_types')
          .update(payload)
          .eq('weight_kg', Number(weightStr));
      }
    }
  } catch (e) {
    // Non-blocking sync
  }

  return updatedRecord;
}

/**
 * Raw cylinder metadata query from Supabase
 */
async function getCylinderTypesRaw(): Promise<CylinderType[]> {
  assertBackendAccess();

  const { data, error } = await supabase.from('cylinder_types').select('*').eq('is_active', true).order('weight_kg');
  if (error) throw new Error('Supabase cylinder_types query failed: ' + error.message);
  if (data && data.length > 0) return data as CylinderType[];

  return [];
}

/**
 * Master Financial Defaults Resolver:
 * Resolves sellingPrice, buyingPrice, and securityDeposit for each cylinder size from agency_settings.
 */
export async function getCurrentCylinderFinancialDefaults(): Promise<CylinderFinancialDefaults> {
  const settings = await getAgencySettings();
  const def4Selling = settings.default_price_4kg ?? settings.default_price_5kg ?? 650;
  const def4Buying = settings.default_buying_price_4kg ?? 600;
  const def4Deposit = settings.default_deposit_4kg ?? 1000;

  return {
    4: {
      sellingPrice: def4Selling,
      buyingPrice: def4Buying,
      securityDeposit: def4Deposit,
    },
    12: {
      sellingPrice: settings.default_price_12kg ?? 1700,
      buyingPrice: settings.default_buying_price_12kg ?? 1625,
      securityDeposit: settings.default_deposit_12kg ?? 2000,
    },
    17: {
      sellingPrice: settings.default_price_17kg ?? 2552,
      buyingPrice: settings.default_buying_price_17kg ?? 2380,
      securityDeposit: settings.default_deposit_17kg ?? 2500,
    },
    21: {
      sellingPrice: settings.default_price_21kg ?? 3152,
      buyingPrice: settings.default_buying_price_21kg ?? 2940,
      securityDeposit: settings.default_deposit_21kg ?? 3000,
    },
  };
}

/**
 * Central Current Selling Prices Resolver:
 * Joins cylinder metadata with selling prices from agency_settings.
 */
export async function getCurrentCylinderPrices(): Promise<{
  cylinderTypes: CylinderType[];
  pricesByWeight: Record<number, number>;
  settings: AgencySettings;
}> {
  const [settings, types] = await Promise.all([
    getAgencySettings(),
    getCylinderTypesRaw(),
  ]);

  const pricesByWeight: Record<number, number> = {
    4: settings.default_price_4kg ?? settings.default_price_5kg ?? 650,
    12: settings.default_price_12kg ?? 1700,
    17: settings.default_price_17kg ?? 2552,
    21: settings.default_price_21kg ?? 3152,
  };

  const resolvedTypes: CylinderType[] = types.map((t) => ({
    ...t,
    default_price: getDefaultPriceForWeight(t.weight_kg, settings),
    default_buying_price: getDefaultBuyingPriceForWeight(t.weight_kg, settings),
    default_deposit: getDefaultDepositForWeight(t.weight_kg, settings),
  }));

  return {
    cylinderTypes: resolvedTypes,
    pricesByWeight,
    settings,
  };
}

/**
 * Central Current Buying Prices Resolver (For Supplier Purchases & Inventory Stock Inflow):
 */
export async function getCurrentCylinderBuyingPrices(): Promise<CylinderType[]> {
  const { cylinderTypes } = await getCurrentCylinderPrices();
  return cylinderTypes;
}

/**
 * Central Current Security Deposits Resolver:
 */
export async function getCurrentCylinderDeposits(): Promise<CylinderType[]> {
  const { cylinderTypes } = await getCurrentCylinderPrices();
  return cylinderTypes;
}

/**
 * Returns active cylinder types with authoritative default_price resolved dynamically from agency_settings.
 */
export async function getCylinderTypes(): Promise<CylinderType[]> {
  const { cylinderTypes } = await getCurrentCylinderPrices();
  return cylinderTypes;
}

// -------------------------------------------------------------
// CUSTOMER MANAGEMENT & SAFE DELETION
// -------------------------------------------------------------
export async function getCustomers(params?: {
  search?: string;
  type?: CustomerType | 'all';
  activeOnly?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ customers: Customer[]; total: number }> {
  assertBackendAccess();
  const { search = '', type = 'all', activeOnly = false, page = 1, limit = 50 } = params || {};

  let query = supabase.from('customers').select('*', { count: 'exact' });
  // Exclude soft-deleted records by default
  query = query.is('deleted_at', null);

  if (activeOnly) query = query.eq('is_active', true);
  if (type !== 'all') query = query.eq('customer_type', type);
  if (search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`customer_code.ilike.${term},name.ilike.${term},company_name.ilike.${term},phone.ilike.${term}`);
  }
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);

  if (!error && data) {
    return { customers: data as Customer[], total: count || data.length };
  }
  if (error) throw new Error('Supabase query customers failed: ' + error.message);

  return { customers: [], total: 0 };
}

/**
 * Safe Customer Deletion Workflow:
 * - If customer has ZERO historical transactions: Executes permanent SQL deletion.
 * - If customer has historical financial records: Executes safe soft-deletion/archiving (deleted_at = now()).
 */
export async function deleteCustomer(customerId: string): Promise<{
  success: boolean;
  mode: 'permanently_deleted' | 'soft_deleted';
  message: string;
}> {
  assertBackendAccess();
  if (!customerId) throw new Error('Customer ID is required.');

  const customer = await getCustomerById(customerId);
  if (!customer) throw new Error('Customer record not found.');

  // 1. Check all dependent records referencing customer_id
  const [pRes, pyRes, dRes, delRes] = await Promise.all([
    supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
    supabase.from('deposits').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
    supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
  ]);
  const purchaseCount = pRes.count || 0;
  const paymentCount = pyRes.count || 0;
  const depositCount = dRes.count || 0;
  const deliveryCount = delRes.count || 0;

  const totalHistoricalRecords = purchaseCount + paymentCount + depositCount + deliveryCount;

  // 2. Decision: Soft Delete vs Permanent Delete
  if (totalHistoricalRecords > 0) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false, deleted_at: now, updated_at: now })
      .eq('id', customerId);
    if (error) throw new Error('Failed to archive customer: ' + error.message);

    await logAudit('Customer Archived / Soft-Deleted', 'customers', customerId, {
      customer_code: customer.customer_code,
      name: customer.name,
      historical_records: totalHistoricalRecords,
    });

    return {
      success: true,
      mode: 'soft_deleted',
      message: `Customer account archived successfully. ${totalHistoricalRecords} historical records preserved.`,
    };
  } else {
    // Permanent SQL Delete: Cascade delete notes/documents/followups first
    await supabase.from('customer_notes').delete().eq('customer_id', customerId);
    await supabase.from('customer_documents').delete().eq('customer_id', customerId);
    await supabase.from('customer_followups').delete().eq('customer_id', customerId);

    const { error } = await supabase.from('customers').delete().eq('id', customerId);
    if (error) throw new Error('Failed to permanently delete customer: ' + error.message);

    await logAudit('Customer Permanently Deleted', 'customers', customerId, {
      customer_code: customer.customer_code,
      name: customer.name,
    });

    return {
      success: true,
      mode: 'permanently_deleted',
      message: 'Customer account permanently deleted.',
    };
  }
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  assertBackendAccess();

  const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
  if (!error && data) return data as Customer;
  if (error && error.code !== 'PGRST116') throw new Error('Supabase get customer failed: ' + error.message);

  return null;
}

function sanitizeCustomerDbPayload(payload: Partial<Customer>): Record<string, any> {
  const allowedKeys = [
    'customer_type',
    'name',
    'company_name',
    'contact_person_name',
    'phone',
    'alternate_phone',
    'area1',
    'area2',
    'street',
    'landmark',
    'city',
    'pincode',
    'district',
    'latitude',
    'longitude',
    'notes',
    'is_active',
    'deleted_at',
  ];
  const sanitized: Record<string, any> = {};
  for (const key of allowedKeys) {
    if (key in payload && (payload as any)[key] !== undefined) {
      sanitized[key] = (payload as any)[key];
    }
  }
  return sanitized;
}

export async function createCustomer(payload: Omit<Customer, 'id' | 'customer_code' | 'created_at' | 'updated_at'>): Promise<Customer> {
  assertBackendAccess();
  const now = new Date().toISOString();

  const dbPayload = sanitizeCustomerDbPayload(payload);
  const { data, error } = await supabase
    .from('customers')
    .insert({
      ...dbPayload,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (!error && data) {
    await logAudit('Customer Created', 'customers', data.id, { name: data.name, code: data.customer_code });
    return data as Customer;
  }
  if (error) throw new Error('Failed to create customer in Supabase: ' + error.message);

  throw new Error('Customer creation failed.');
}

export async function createCustomerWithInitialGas(payload: {
  customer_type: 'individual' | 'company';
  name: string;
  company_name?: string;
  contact_person_name?: string;
  phone: string;
  alternate_phone?: string;
  area1?: string;
  area2?: string;
  street?: string;
  landmark?: string;
  city?: string;
  pincode?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  sms_enabled?: boolean;
  whatsapp_enabled?: boolean;
  email_enabled?: boolean;
  marketing_enabled?: boolean;
  // Initial Gas
  cylinder_type_id?: string;
  quantity?: number;
  unit_price?: number;
  deposit_amount?: number;
  payment_amount?: number;
  payment_method?: 'cash' | 'upi' | 'bank_transfer' | 'other';
  purchase_date?: string;
}): Promise<Customer> {
  assertBackendAccess();
  const now = new Date().toISOString();

  const sanitizedCylinderTypeId = isValidUUID(payload.cylinder_type_id) ? payload.cylinder_type_id : null;

  const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_customer_with_initial_gas', {
    p_customer_type: payload.customer_type,
    p_name: payload.name,
    p_company_name: payload.company_name || null,
    p_contact_person_name: payload.contact_person_name || null,
    p_phone: payload.phone,
    p_alternate_phone: payload.alternate_phone || null,
    p_area1: payload.area1 || null,
    p_area2: payload.area2 || null,
    p_street: payload.street || null,
    p_landmark: payload.landmark || null,
    p_city: payload.city || 'Tiruppur',
    p_pincode: payload.pincode || null,
    p_district: payload.district || 'Tiruppur',
    p_latitude: payload.latitude || null,
    p_longitude: payload.longitude || null,
    p_notes: payload.notes || null,
    p_cylinder_type_id: sanitizedCylinderTypeId,
    p_quantity: payload.quantity || 0,
    p_unit_price: payload.unit_price || 0,
    p_deposit_amount: payload.deposit_amount || 0,
    p_payment_amount: payload.payment_amount || 0,
    p_payment_method: payload.payment_method || 'cash',
    p_purchase_date: payload.purchase_date || now.split('T')[0],
  });

  if (rpcErr) {
    throw new Error('Supabase customer creation failed: ' + rpcErr.message);
  }

  if (rpcRes && rpcRes.customer_id) {
    const created = await getCustomerById(rpcRes.customer_id);
    if (created) return created;
  }

  throw new Error('Failed to retrieve newly created customer record from Supabase.');
}

export async function updateCustomer(id: string, payload: Partial<Customer>): Promise<Customer> {
  assertBackendAccess();
  const now = new Date().toISOString();

  const dbPayload = sanitizeCustomerDbPayload(payload);
  const { data, error } = await supabase.from('customers').update({ ...dbPayload, updated_at: now }).eq('id', id).select().single();
  if (!error && data) {
    await logAudit('Customer Updated', 'customers', id, payload);
    return data as Customer;
  }
  if (error) throw new Error('Failed to update customer in Supabase: ' + error.message);

  throw new Error('Customer update failed.');
}

export async function toggleCustomerActive(id: string, isActive: boolean): Promise<Customer> {
  return updateCustomer(id, { is_active: isActive });
}

// -------------------------------------------------------------
// CUSTOMER DOCUMENTS (PRIVATE SUPABASE BUCKET)
// -------------------------------------------------------------
export async function getCustomerDocuments(customerId: string): Promise<CustomerDocument[]> {
  assertBackendAccess();

  const { data, error } = await supabase.from('customer_documents').select('*').eq('customer_id', customerId).order('uploaded_at', { ascending: false });
  if (!error && data) {
    // Create authenticated signed URLs for private files
    const docsWithUrls = await Promise.all(
      data.map(async (doc: CustomerDocument) => {
        const { data: signedData } = await supabase.storage.from('customer-documents').createSignedUrl(doc.storage_path, 3600);
        return { ...doc, signed_url: signedData?.signedUrl || null };
      })
    );
    return docsWithUrls;
  }
  if (error) throw new Error('Supabase get documents failed: ' + error.message);

  return [];
}

export async function uploadCustomerDocument(customerId: string, file: File, docType: DocumentType): Promise<CustomerDocument> {
  assertBackendAccess();

  const fileExt = file.name.split('.').pop();
  const filePath = `${customerId}/${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${fileExt}`;
  const now = new Date().toISOString();

  const { error: uploadErr } = await supabase.storage.from('customer-documents').upload(filePath, file, { upsert: true });
  if (uploadErr) throw new Error('Supabase Storage upload failed: ' + uploadErr.message);

  const { data, error } = await supabase
    .from('customer_documents')
    .insert({
      customer_id: customerId,
      document_type: docType,
      storage_path: filePath,
      original_filename: file.name,
      mime_type: file.type,
      file_size: file.size,
      uploaded_at: now,
    })
    .select()
    .single();

  if (!error && data) {
    await logAudit('Document Uploaded', 'customer_documents', data.id, { filename: file.name, docType });
    return data as CustomerDocument;
  }
  if (error) throw new Error('Supabase customer_documents insert failed: ' + error.message);

  throw new Error('Document upload failed.');
}

export async function deleteCustomerDocument(docId: string, storagePath: string): Promise<void> {
  assertBackendAccess();

  const { error: removeStorageErr } = await supabase.storage.from('customer-documents').remove([storagePath]);
  if (removeStorageErr) console.warn('Storage remove object warning:', removeStorageErr.message);

  const { error: deleteTableErr } = await supabase.from('customer_documents').delete().eq('id', docId);
  if (deleteTableErr) throw new Error('Failed to delete document metadata from table: ' + deleteTableErr.message);

  await logAudit('Document Deleted', 'customer_documents', docId, { storagePath });
}

// -------------------------------------------------------------
// PURCHASES & SALES
// -------------------------------------------------------------
export async function getPurchases(params?: { customerId?: string; search?: string }): Promise<Purchase[]> {
  assertBackendAccess();
  const { customerId } = params || {};

  let query = supabase.from('purchases').select('*, customer:customers(*), items:purchase_items(*, cylinder_type:cylinder_types(*))').order('purchase_date', { ascending: false });
  if (customerId) query = query.eq('customer_id', customerId);
  const { data, error } = await query;
  if (!error && data) return data as Purchase[];
  if (error) throw new Error('Supabase query purchases failed: ' + error.message);

  return [];
}

export async function createPurchase(payload: {
  customer_id: string;
  purchase_date: string;
  items: { cylinder_type_id: string; quantity: number; unit_price: number }[];
  deposit_amount?: number;
  deposit_payment_method?: 'cash' | 'upi' | 'bank_transfer' | 'other';
  payment_amount?: number;
  payment_method?: 'cash' | 'upi' | 'bank_transfer' | 'other';
  delivery_status?: 'pending' | 'delivered';
  notes?: string;
}): Promise<Purchase> {
  assertBackendAccess();

  let totalGas = 0;
  const itemsPrepared = payload.items.map((i) => {
    const total = i.quantity * i.unit_price;
    totalGas += total;
    return {
      cylinder_type_id: i.cylinder_type_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total_price: total,
    };
  });

  const customer = await getCustomerById(payload.customer_id);

  const { data: purData, error: purErr } = await supabase
    .from('purchases')
    .insert({
      customer_id: payload.customer_id,
      purchase_date: payload.purchase_date,
      total_gas_amount: totalGas,
      notes: payload.notes,
    })
    .select()
    .single();

  if (!purErr && purData) {
    const itemsToInsert = itemsPrepared.map((i) => ({ ...i, purchase_id: purData.id }));
    const { error: itemsErr } = await supabase.from('purchase_items').insert(itemsToInsert);
    if (itemsErr) console.error('Error inserting purchase items:', itemsErr);

    // Deposit record (tracked separately from gas sales)
    if (payload.deposit_amount && payload.deposit_amount > 0) {
      await createDeposit({
        customer_id: payload.customer_id,
        purchase_id: purData.id,
        amount: payload.deposit_amount,
        status: 'held',
        payment_method: payload.deposit_payment_method || 'cash',
        transaction_date: payload.purchase_date,
        notes: 'Deposit for purchase ' + purData.purchase_code,
      });
    }

    // Payment record
    if (payload.payment_amount && payload.payment_amount > 0) {
      const isFull = payload.payment_amount >= totalGas;
      await createPayment({
        customer_id: payload.customer_id,
        purchase_id: purData.id,
        amount: payload.payment_amount,
        payment_method: payload.payment_method || 'cash',
        payment_date: payload.purchase_date,
        status: isFull ? 'paid' : 'partial',
        notes: 'Payment for purchase ' + purData.purchase_code,
      });
    }

    // Delivery record
    const address = customer ? [customer.street, customer.area1, customer.area2, customer.city].filter(Boolean).join(', ') : 'Customer Address';
    await createDelivery({
      customer_id: payload.customer_id,
      purchase_id: purData.id,
      delivery_date: payload.purchase_date,
      delivery_address: address,
      latitude: customer?.latitude || undefined,
      longitude: customer?.longitude || undefined,
      status: payload.delivery_status === 'delivered' ? 'delivered' : 'pending',
      notes: 'Delivery for purchase ' + purData.purchase_code,
      items: itemsPrepared.map((i) => ({ cylinder_type_id: i.cylinder_type_id, quantity: i.quantity })),
    });

    await logAudit('Purchase Created', 'purchases', purData.id, { code: purData.purchase_code, totalGas });
    return purData as Purchase;
  }
  if (purErr) throw new Error('Supabase create purchase failed: ' + purErr.message);

  throw new Error('Purchase creation failed.');
}

/**
 * Safely updates the business purchase_date of an existing purchase.
 * Preserves the purchase ID, purchase code, and immutable created_at timestamp.
 */
export async function updatePurchaseDate(purchaseId: string, newPurchaseDate: string): Promise<Purchase> {
  assertBackendAccess();
  if (!purchaseId || !isValidUUID(purchaseId)) {
    throw new Error('Valid Purchase ID is required.');
  }
  if (!newPurchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(newPurchaseDate)) {
    throw new Error('Valid purchase date in YYYY-MM-DD format is required.');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('purchases')
    .update({
      purchase_date: newPurchaseDate,
      updated_at: now,
    })
    .eq('id', purchaseId)
    .select('*, customer:customers(*), items:purchase_items(*, cylinder_type:cylinder_types(*))')
    .single();

  if (error) throw new Error('Failed to update purchase date in Supabase: ' + error.message);
  if (!data) throw new Error('Purchase record not found.');

  await logAudit('Purchase Date Updated', 'purchases', purchaseId, {
    purchase_code: data.purchase_code,
    old_purchase_date: (data as any).purchase_date,
    new_purchase_date: newPurchaseDate,
  });

  return data as Purchase;
}

/**
 * Safely deletes a customer purchase record and its associated items.
 * Cleans up linked delivery and transaction records created for this purchase.
 */
export async function deletePurchase(purchaseId: string): Promise<{ success: boolean; message: string }> {
  assertBackendAccess();
  if (!purchaseId || !isValidUUID(purchaseId)) {
    throw new Error('Valid Purchase ID is required.');
  }

  // 1. Fetch existing purchase record for verification and audit logging
  const { data: purchase, error: fetchErr } = await supabase
    .from('purchases')
    .select('*, customer:customers(name)')
    .eq('id', purchaseId)
    .single();

  if (fetchErr || !purchase) {
    throw new Error('Purchase record not found or already deleted.');
  }

  const purchaseCode = purchase.purchase_code || 'Unknown';
  const customerName = (purchase.customer as any)?.name || 'Unknown Customer';

  // 2. Delete purchase_items first to ensure child records are removed
  const { error: itemsErr } = await supabase
    .from('purchase_items')
    .delete()
    .eq('purchase_id', purchaseId);

  if (itemsErr) {
    console.warn('Warning deleting purchase items:', itemsErr.message);
  }

  // 3. Clean up linked deposits, payments, and deliveries created specifically for this purchase
  await supabase.from('deposits').delete().eq('purchase_id', purchaseId);
  await supabase.from('payments').delete().eq('purchase_id', purchaseId);
  await supabase.from('deliveries').delete().eq('purchase_id', purchaseId);

  // 4. Delete the purchase record
  const { error: delErr } = await supabase
    .from('purchases')
    .delete()
    .eq('id', purchaseId);

  if (delErr) {
    throw new Error('Failed to delete purchase from Supabase: ' + delErr.message);
  }

  // 5. Record audit log
  await logAudit('Purchase Deleted', 'purchases', purchaseId, {
    purchase_code: purchaseCode,
    customer_id: purchase.customer_id,
    customer_name: customerName,
    total_gas_amount: purchase.total_gas_amount,
    purchase_date: purchase.purchase_date,
  });

  return {
    success: true,
    message: `Purchase ${purchaseCode} deleted successfully.`,
  };
}

// -------------------------------------------------------------
// DEPOSITS (TRACKED SEPARATELY FROM GAS REVENUE)
// -------------------------------------------------------------
export async function getDeposits(customerId?: string): Promise<Deposit[]> {
  assertBackendAccess();

  let query = supabase.from('deposits').select('*, customer:customers(*)').order('transaction_date', { ascending: false });
  if (customerId) query = query.eq('customer_id', customerId);
  const { data, error } = await query;
  if (!error && data) return data as Deposit[];
  if (error) throw new Error('Supabase query deposits failed: ' + error.message);

  return [];
}

export async function createDeposit(payload: Omit<Deposit, 'id' | 'created_at'>): Promise<Deposit> {
  assertBackendAccess();
  const now = new Date().toISOString();

  const { data, error } = await supabase.from('deposits').insert({ ...payload, created_at: now }).select().single();
  if (!error && data) {
    await logAudit('Deposit Recorded', 'deposits', data.id, { amount: payload.amount, status: payload.status });
    return data as Deposit;
  }
  if (error) throw new Error('Supabase create deposit failed: ' + error.message);

  throw new Error('Deposit creation failed.');
}

// -------------------------------------------------------------
// PAYMENTS & OUTSTANDING
// -------------------------------------------------------------
export async function getPayments(customerId?: string): Promise<Payment[]> {
  assertBackendAccess();

  let query = supabase.from('payments').select('*, customer:customers(*)').order('payment_date', { ascending: false });
  if (customerId) query = query.eq('customer_id', customerId);
  const { data, error } = await query;
  if (!error && data) return data as Payment[];
  if (error) throw new Error('Supabase query payments failed: ' + error.message);

  return [];
}

export async function createPayment(payload: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
  assertBackendAccess();
  const now = new Date().toISOString();

  const { data, error } = await supabase.from('payments').insert({ ...payload, created_at: now }).select().single();
  if (!error && data) {
    await logAudit('Payment Recorded', 'payments', data.id, { amount: payload.amount, method: payload.payment_method });
    return data as Payment;
  }
  if (error) throw new Error('Supabase create payment failed: ' + error.message);

  throw new Error('Payment creation failed.');
}

// Dynamic Outstanding calculation per customer
// Outstanding = Total Gas Purchases Amount - Total Payments Applied
export async function getCustomerFinancials(customerId: string): Promise<{
  totalGasPurchases: number;
  totalPayments: number;
  outstanding: number;
  depositHeld: number;
  totalCylindersPurchased: number;
  lastPurchaseDate?: string;
}> {
  const purchases = await getPurchases({ customerId });
  const payments = await getPayments(customerId);
  const deposits = await getDeposits(customerId);

  const totalGasPurchases = purchases.reduce((acc, p) => acc + (p.total_gas_amount || 0), 0);
  const totalPayments = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const outstanding = Math.max(0, totalGasPurchases - totalPayments);

  const depositHeld = deposits.reduce((acc, d) => {
    if (d.status === 'held' || d.status === 'given') return acc + d.amount;
    if (d.status === 'refunded' || d.status === 'adjusted') return acc - d.amount;
    return acc;
  }, 0);

  let totalCylindersPurchased = 0;
  purchases.forEach((p) => {
    p.items?.forEach((i) => {
      totalCylindersPurchased += i.quantity;
    });
  });

  const lastPurchaseDate = purchases.length > 0 ? purchases[0].purchase_date : undefined;

  return {
    totalGasPurchases,
    totalPayments,
    outstanding,
    depositHeld: Math.max(0, depositHeld),
    totalCylindersPurchased,
    lastPurchaseDate,
  };
}

// -------------------------------------------------------------
// CYLINDER INVENTORY & MOVEMENT
// -------------------------------------------------------------
export async function getCylinders(statusFilter?: CylinderStatus): Promise<Cylinder[]> {
  assertBackendAccess();

  let query = supabase.from('cylinders').select('*, cylinder_type:cylinder_types(*), current_customer:customers(*)');
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (!error && data) return data as Cylinder[];
  if (error) throw new Error('Supabase query cylinders failed: ' + error.message);

  return [];
}

export async function recordCylinderReturn(payload: {
  customer_id: string;
  cylinder_type_id: string;
  quantity: number;
  condition: 'good' | 'damaged' | 'needs_inspection';
  notes?: string;
}): Promise<void> {
  assertBackendAccess();
  const now = new Date().toISOString();
  const qtyToReturn = Math.max(1, Number(payload.quantity));

  // 1. Validate customer active holdings
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, items:purchase_items(*)')
    .eq('customer_id', payload.customer_id);

  let totalPurchased = 0;
  (purchases || []).forEach((p: any) => {
    p.items?.forEach((it: any) => {
      if (it.cylinder_type_id === payload.cylinder_type_id) {
        totalPurchased += it.quantity;
      }
    });
  });

  const { data: priorMovements } = await supabase
    .from('cylinder_movements')
    .select('*')
    .eq('customer_id', payload.customer_id)
    .eq('movement_type', 'returned');

  let totalReturned = 0;
  (priorMovements || []).forEach((m: any) => {
    const qtyMatch = m.notes?.match(/Returned\s+(\d+)\s+cylinders/i);
    totalReturned += qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  });

  const activeHolding = Math.max(0, totalPurchased - totalReturned);
  if (qtyToReturn > activeHolding) {
    throw new Error(`Cannot return ${qtyToReturn} cylinders. Customer only holds ${activeHolding} active cylinders on record.`);
  }

  const { error } = await supabase.from('cylinder_movements').insert({
    customer_id: payload.customer_id,
    movement_type: 'returned',
    movement_date: now,
    notes: `Returned ${qtyToReturn} cylinders (${payload.condition}): ${payload.notes || ''}`,
  });
  if (error) throw new Error('Supabase cylinder_movements insert failed: ' + error.message);

  await logAudit('Cylinder Returned', 'cylinders', payload.customer_id, payload);
}

// -------------------------------------------------------------
// INVENTORY OPENING BALANCES (NORMALIZED SUPABASE AUTHORITATIVE TABLE)
// -------------------------------------------------------------

/**
 * Retrieves all inventory opening balance records from Supabase.
 */
export async function getInventoryOpeningBalances(): Promise<InventoryOpeningBalance[]> {
  assertBackendAccess();

  const { data, error } = await supabase
    .from('inventory_opening_balances')
    .select('*, cylinder_type:cylinder_types(*)')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Supabase getInventoryOpeningBalances failed: ' + error.message);
  }

  return (data || []) as InventoryOpeningBalance[];
}

/**
 * Persists inventory opening balances atomically in Supabase via RPC or direct update with audit logging.
 */
export async function updateInventoryOpeningBalances(
  updates: Array<{ cylinder_type_id: string; opening_full_quantity: number }>
): Promise<InventoryOpeningBalance[]> {
  assertBackendAccess();

  if (!updates || updates.length === 0) {
    throw new Error('No balance updates provided.');
  }

  // Validate inputs
  for (const item of updates) {
    if (!item.cylinder_type_id || !isValidUUID(item.cylinder_type_id)) {
      throw new Error(`Invalid cylinder type ID: ${item.cylinder_type_id}`);
    }
    const qty = Number(item.opening_full_quantity);
    if (isNaN(qty) || !isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      throw new Error('Opening full quantity must be a non-negative whole integer.');
    }
    if (qty > 100000) {
      throw new Error('Opening full quantity cannot exceed 100,000 units.');
    }
  }

  // Try PostgreSQL RPC for atomic save + audit log
  const { data: rpcData, error: rpcError } = await supabase.rpc('update_inventory_opening_balances', {
    p_balances: updates,
  });

  if (!rpcError && rpcData) {
    return await getInventoryOpeningBalances();
  }

  if (rpcError) {
    console.warn('RPC update_inventory_opening_balances failed, attempting direct upsert:', rpcError.message);
    // Fallback: direct upsert with audit logging
    const results: InventoryOpeningBalance[] = [];
    for (const item of updates) {
      const { data, error } = await supabase
        .from('inventory_opening_balances')
        .upsert(
          {
            cylinder_type_id: item.cylinder_type_id,
            opening_full_quantity: item.opening_full_quantity,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'cylinder_type_id' }
        )
        .select('*, cylinder_type:cylinder_types(*)')
        .single();

      if (error) {
        throw new Error('Failed to update opening balance: ' + error.message);
      }
      if (data) {
        await logAudit('opening_stock_updated', 'inventory_opening_balances', data.id, {
          cylinder_type_id: item.cylinder_type_id,
          new_opening_quantity: item.opening_full_quantity,
        });
        results.push(data as InventoryOpeningBalance);
      }
    }
    return results;
  }

  return await getInventoryOpeningBalances();
}

// Dynamic breakdown of cylinder stock across canonical sizes (4 kg, 12 kg, 17 kg, 21 kg)
export async function getCylinderStockSummary(): Promise<CylinderStockSummary[]> {
  const [types, purchases, deliveries, openingBalances] = await Promise.all([
    getCylinderTypes(),
    getPurchases(),
    getDeliveries(),
    getInventoryOpeningBalances(),
  ]);

  // Aggregate supplier stock intake
  const supplierIntakeMap: Record<string, number> = {};
  try {
    const suppPurchases = await getSupplierPurchases();
    suppPurchases
      .filter((sp) => sp.status === 'confirmed')
      .forEach((sp) => {
        sp.items?.forEach((it) => {
          const matched = types.find((t) => t.id === it.cylinder_type_id || t.name.toLowerCase().includes(String(it.cylinder_type_id).toLowerCase()));
          const key = matched ? matched.id : it.cylinder_type_id;
          supplierIntakeMap[key] = (supplierIntakeMap[key] || 0) + it.quantity;
        });
      });
  } catch (e) {
    // Non-blocking
  }

  // Aggregate customer cylinder returns from cylinder_movements
  const returnsMap: Record<string, number> = {};
  try {
    const { data: movements } = await supabase
      .from('cylinder_movements')
      .select('*')
      .eq('movement_type', 'returned');
    (movements || []).forEach((m) => {
      const qtyMatch = m.notes?.match(/Returned\s+(\d+)\s+cylinders/i);
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
      types.forEach((t) => {
        if (m.notes?.toLowerCase().includes(t.name.toLowerCase()) || m.notes?.toLowerCase().includes(`${t.weight_kg}kg`)) {
          returnsMap[t.id] = (returnsMap[t.id] || 0) + qty;
        }
      });
    });
  } catch (e) {
    // Non-blocking
  }

  return types.map((type) => {
    // 1. Total purchased across all customer orders
    let totalPurchased = 0;
    purchases.forEach((p) => {
      p.items?.forEach((item) => {
        if (item.cylinder_type_id === type.id || item.cylinder_type?.name === type.name) {
          totalPurchased += item.quantity;
        }
      });
    });

    // 2. Breakdown of active deliveries in transit vs pending allocation
    let inDelivery = 0;
    let pendingAllocated = 0;
    deliveries.forEach((d) => {
      d.items?.forEach((item) => {
        if (item.cylinder_type_id === type.id || item.cylinder_type?.name === type.name) {
          if (d.status === 'out_for_delivery' || d.status === 'assigned') {
            inDelivery += item.quantity;
          } else if (d.status === 'pending') {
            pendingAllocated += item.quantity;
          }
        }
      });
    });

    const returnedCount = returnsMap[type.id] || 0;
    // With Customer = Total delivered cylinders currently held by customer (purchased - in-transit - pending - returned)
    const withCustomer = Math.max(0, totalPurchased - inDelivery - pendingAllocated - returnedCount);
    // Empty stock = cylinders returned to agency warehouse
    const empty = returnedCount;

    const supplierIntake = supplierIntakeMap[type.id] || 0;
    
    // Authoritative Opening Balance from inventory_opening_balances table
    const openingRec = openingBalances.find((b) => b.cylinder_type_id === type.id);
    const opening_balance = openingRec ? openingRec.opening_full_quantity : 0;
    const baseTotal = opening_balance + supplierIntake;

    // Available Full Stock = Total Owned - In Delivery - Pending Allocated - With Customer - Empty in Warehouse
    const available = Math.max(0, baseTotal - pendingAllocated - inDelivery - withCustomer - empty);

    return {
      size: type.name,
      cylinder_type_id: type.id,
      weight_kg: type.weight_kg,
      opening_balance,
      available,
      withCustomer,
      empty,
      inDelivery,
      total: baseTotal, // Total inventory owned = opening baseline + confirmed supplier intakes
    };
  });
}

// -------------------------------------------------------------
// DELIVERIES & FIELD WORKFLOW
// -------------------------------------------------------------
export async function getDeliveries(params?: { status?: DeliveryStatus; date?: string; customerId?: string }): Promise<Delivery[]> {
  assertBackendAccess();
  const { status, date, customerId } = params || {};

  let query = supabase.from('deliveries').select('*, customer:customers(*), items:delivery_items(*, cylinder_type:cylinder_types(*))').order('delivery_date', { ascending: false });
  if (status) query = query.eq('status', status);
  if (date) query = query.eq('delivery_date', date);
  if (customerId) query = query.eq('customer_id', customerId);
  const { data, error } = await query;
  if (!error && data) return data as Delivery[];
  if (error) throw new Error('Supabase query deliveries failed: ' + error.message);

  return [];
}

export async function createDelivery(payload: {
  customer_id: string;
  purchase_id?: string;
  delivery_date: string;
  delivery_address: string;
  latitude?: number;
  longitude?: number;
  status?: DeliveryStatus;
  notes?: string;
  items?: { cylinder_type_id: string; quantity: number }[];
}): Promise<Delivery> {
  assertBackendAccess();

  const { data, error } = await supabase
    .from('deliveries')
    .insert({
      customer_id: payload.customer_id,
      purchase_id: payload.purchase_id,
      delivery_date: payload.delivery_date,
      delivery_address: payload.delivery_address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      status: payload.status || 'pending',
      notes: payload.notes,
    })
    .select()
    .single();

  if (!error && data) {
    if (payload.items && payload.items.length > 0) {
      await supabase.from('delivery_items').insert(payload.items.map((i) => ({ ...i, delivery_id: data.id })));
    }
    await logAudit('Delivery Scheduled', 'deliveries', data.id, { code: data.delivery_code });
    return data as Delivery;
  }
  if (error) throw new Error('Supabase create delivery failed: ' + error.message);

  throw new Error('Delivery creation failed.');
}

export async function updateDeliveryStatus(id: string, newStatus: DeliveryStatus, notes?: string): Promise<Delivery> {
  assertBackendAccess();
  const now = new Date().toISOString();

  const { data, error } = await supabase.from('deliveries').update({ status: newStatus, notes, updated_at: now }).eq('id', id).select().single();
  if (!error && data) {
    await logAudit('Delivery Status Changed', 'deliveries', id, { newStatus });
    return data as Delivery;
  }
  if (error) throw new Error('Supabase update delivery status failed: ' + error.message);

  throw new Error('Delivery status update failed.');
}

// -------------------------------------------------------------
// DASHBOARD STATS & ANALYTICS
// -------------------------------------------------------------
export async function getDashboardStats(): Promise<DashboardStats> {
  assertBackendAccess();

  const { customers, total: totalCust } = await getCustomers({ limit: 1000 });
  const activeCustomers = customers.filter((c) => c.is_active).length;
  const individualCustomers = customers.filter((c) => c.customer_type === 'individual').length;
  const companyCustomers = customers.filter((c) => c.customer_type === 'company').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const deliveries = await getDeliveries();
  const todaysDeliveries = deliveries.filter((d) => d.delivery_date === todayStr).length;
  const pendingDeliveries = deliveries.filter((d) => d.status === 'pending' || d.status === 'assigned' || d.status === 'out_for_delivery').length;

  const purchases = await getPurchases();
  const currentMonthPrefix = new Date().toISOString().substring(0, 7);
  const thisMonthSales = purchases
    .filter((p) => p.purchase_date.startsWith(currentMonthPrefix))
    .reduce((sum, p) => sum + p.total_gas_amount, 0);

  const payments = await getPayments();
  const totalGasPurchasedAllTime = purchases.reduce((sum, p) => sum + p.total_gas_amount, 0);
  const totalPaidAllTime = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstandingPayments = Math.max(0, totalGasPurchasedAllTime - totalPaidAllTime);

  const deposits = await getDeposits();
  const totalDepositsHeld = deposits.reduce((sum, d) => (d.status === 'held' || d.status === 'given' ? sum + d.amount : sum), 0);

  const cylinderStock = await getCylinderStockSummary();
  const availableCylinders = cylinderStock.reduce((sum, c) => sum + c.available, 0);

  return {
    totalCustomers: totalCust,
    activeCustomers,
    individualCustomers,
    companyCustomers,
    todaysDeliveries,
    pendingDeliveries,
    thisMonthSales,
    outstandingPayments,
    totalDepositsHeld,
    availableCylinders,
    supplierPurchasesMonth: 0,
    supplierOutstanding: 0,
  };
}

// Customers due for follow-up (30+, 60+, 90+ days without purchase)
export async function getFollowUpCustomers(): Promise<{
  customer: Customer;
  daysSinceLastPurchase: number;
  lastPurchaseDate?: string;
}[]> {
  assertBackendAccess();

  const { customers } = await getCustomers({ activeOnly: true, limit: 1000 });
  const purchases = await getPurchases();

  const results: { customer: Customer; daysSinceLastPurchase: number; lastPurchaseDate?: string }[] = [];
  const nowMs = Date.now();

  for (const cust of customers) {
    const custPurchases = purchases.filter((p) => p.customer_id === cust.id);
    if (custPurchases.length === 0) {
      const createdMs = new Date(cust.created_at).getTime();
      const days = Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24));
      if (days >= 30) {
        results.push({ customer: cust, daysSinceLastPurchase: days });
      }
    } else {
      const latestDateStr = custPurchases[0].purchase_date;
      const latestMs = new Date(latestDateStr).getTime();
      const days = Math.floor((nowMs - latestMs) / (1000 * 60 * 60 * 24));
      if (days >= 30) {
        results.push({ customer: cust, daysSinceLastPurchase: days, lastPurchaseDate: latestDateStr });
      }
    }
  }

  return results.sort((a, b) => b.daysSinceLastPurchase - a.daysSinceLastPurchase);
}

// -------------------------------------------------------------
// AUDIT LOGGING SERVICE
// -------------------------------------------------------------
export async function logAudit(action: string, entityType: string, entityId?: string, metadata?: Record<string, any>): Promise<void> {
  assertBackendAccess();
  const now = new Date().toISOString();

  try {
    await supabase.from('audit_logs').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      created_at: now,
    });
  } catch (e) {
    console.warn('Audit logging warning:', e);
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  assertBackendAccess();

  const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
  if (!error && data) return data as AuditLog[];

  return [];
}

// -------------------------------------------------------------
// CRM TIMELINE, NOTES & FOLLOW-UPS
// -------------------------------------------------------------
export async function getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  assertBackendAccess();

  const { data: noteData, error: noteErr } = await supabase
    .from('customer_notes')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (!noteErr && noteData && noteData.length > 0) {
    return noteData as CustomerNote[];
  }

  const { data, error } = await supabase.from('audit_logs').select('*').eq('entity_id', customerId).eq('action', 'customer_note_added').order('created_at', { ascending: false });
  if (!error && data) {
    return data.map((d) => ({
      id: d.id,
      customer_id: customerId,
      note: d.metadata?.note || '',
      created_by_name: d.metadata?.created_by_name || 'SRI SS Admin',
      created_at: d.created_at,
    }));
  }

  return [];
}

export async function addCustomerNote(customerId: string, note: string, createdByName: string = 'SRI SS Admin'): Promise<CustomerNote> {
  assertBackendAccess();
  const now = new Date().toISOString();
  const newNote: CustomerNote = {
    id: 'note-' + Date.now(),
    customer_id: customerId,
    note,
    created_by_name: createdByName,
    created_at: now,
  };

  const { data, error } = await supabase.from('customer_notes').insert({
    customer_id: customerId,
    note,
    created_by_name: createdByName,
  }).select().single();

  await logAudit('customer_note_added', 'customers', customerId, { note, created_by_name: createdByName });

  if (!error && data) {
    return data as CustomerNote;
  }

  return newNote;
}

export async function getCustomerTimeline(customerId: string): Promise<ActivityTimelineItem[]> {
  assertBackendAccess();

  const customer = await getCustomerById(customerId);
  if (!customer) return [];

  const [purchases, payments, deposits, deliveries, docs, notes] = await Promise.all([
    getPurchases({ customerId }),
    getPayments(customerId),
    getDeposits(customerId),
    getDeliveries({ customerId }),
    getCustomerDocuments(customerId),
    getCustomerNotes(customerId),
  ]);

  const timeline: ActivityTimelineItem[] = [];

  // Customer created
  timeline.push({
    id: `creation-${customer.id}`,
    date: customer.created_at,
    title: 'Customer Profile Registered',
    description: `Customer ${customer.name} (${customer.customer_code}) was registered in the system.`,
    type: 'customer_created',
  });

  // Customer edited if updated_at != created_at
  if (customer.updated_at && customer.updated_at !== customer.created_at) {
    timeline.push({
      id: `edit-${customer.id}-${customer.updated_at}`,
      date: customer.updated_at,
      title: 'Customer Profile Updated',
      description: 'Customer contact or location information was modified.',
      type: 'customer_updated',
    });
  }

  // Purchases
  purchases.forEach((p) => {
    timeline.push({
      id: `pur-${p.id}`,
      date: p.purchase_date || p.created_at,
      title: `Gas Cylinder Purchase (${p.purchase_code})`,
      description: `Purchased gas cylinders totaling ₹${p.total_gas_amount.toLocaleString('en-IN')}`,
      type: 'purchase',
      amount: p.total_gas_amount,
    });
  });

  // Payments
  payments.forEach((pay) => {
    timeline.push({
      id: `pay-${pay.id}`,
      date: pay.payment_date || pay.created_at,
      title: `Payment Received (${pay.payment_method.toUpperCase()})`,
      description: `Received payment of ₹${pay.amount.toLocaleString('en-IN')}`,
      type: 'payment',
      amount: pay.amount,
      status: pay.status,
    });
  });

  // Deposits
  deposits.forEach((dep) => {
    timeline.push({
      id: `dep-${dep.id}`,
      date: dep.transaction_date || dep.created_at,
      title: `Security Deposit (${dep.status.toUpperCase()})`,
      description: `Cylinder deposit of ₹${dep.amount.toLocaleString('en-IN')} via ${dep.payment_method.toUpperCase()}`,
      type: 'deposit',
      amount: dep.amount,
      status: dep.status,
    });
  });

  // Deliveries
  deliveries.forEach((del) => {
    timeline.push({
      id: `del-${del.id}`,
      date: del.delivery_date || del.created_at,
      title: `Delivery ${del.delivery_code} (${del.status.toUpperCase()})`,
      description: `Delivery scheduled to ${del.delivery_address}`,
      type: 'delivery',
      status: del.status,
    });
  });

  // Documents
  docs.forEach((doc) => {
    timeline.push({
      id: `doc-${doc.id}`,
      date: doc.uploaded_at,
      title: `Document Uploaded (${doc.document_type.toUpperCase()})`,
      description: `Uploaded document: ${doc.original_filename}`,
      type: 'document',
    });
  });

  // Notes
  notes.forEach((n) => {
    timeline.push({
      id: `note-${n.id}`,
      date: n.created_at,
      title: `Admin Note`,
      description: `${n.created_by_name || 'Admin'}: "${n.note}"`,
      type: 'note',
    });
  });

  // Sort newest first
  return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
