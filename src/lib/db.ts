import { supabase, isSupabaseConfigured, isMockModeAllowed, SupabaseNotConfiguredError } from './supabase';
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
  CylinderMovement,
  AuditLog,
  AgencySettings,
  DashboardStats,
  CylinderStockSummary,
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

// Local persistence helper (ONLY executed if isMockModeAllowed() is true)
const STORAGE_KEY_PREFIX = 'srissgas_db_';
const memoryStore = new Map<string, string>();

function getLocal<T>(key: string, defaultValue: T): T {
  try {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      return item ? JSON.parse(item) : defaultValue;
    }
    const memItem = memoryStore.get(STORAGE_KEY_PREFIX + key);
    return memItem ? JSON.parse(memItem) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
    } else {
      memoryStore.set(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
    }
  } catch (e) {
    console.error('Failed to save to local persistence:', e);
  }
}

function assertBackendAccess(): void {
  if (!isSupabaseConfigured() && !isMockModeAllowed()) {
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

// Sequence generators for fallback
function nextCode(prefix: string, key: string): string {
  const current = getLocal<number>(key, 1);
  setLocal(key, current + 1);
  return `${prefix}-${String(current).padStart(6, '0')}`;
}

// -------------------------------------------------------------
// AGENCY SETTINGS & AUTHORITATIVE CYLINDER PRICING
// -------------------------------------------------------------

/**
 * Retrieves the single authoritative agency settings row from Supabase or fallback.
 */
export async function getAgencySettings(): Promise<AgencySettings> {
  assertBackendAccess();

  if (isSupabaseConfigured()) {
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
  }

  if (isMockModeAllowed()) {
    return getLocal<AgencySettings>('agency_settings', DEFAULT_AGENCY_SETTINGS);
  }

  throw new SupabaseNotConfiguredError();
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

  if (isSupabaseConfigured()) {
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

    if (isMockModeAllowed()) {
      setLocal('agency_settings', updatedRecord);
    }

    return updatedRecord;
  }

  if (isMockModeAllowed()) {
    const current = await getAgencySettings();
    const updated: AgencySettings = {
      ...current,
      ...validated,
      updated_at: new Date().toISOString(),
    };
    setLocal('agency_settings', updated);
    return updated;
  }

  throw new SupabaseNotConfiguredError();
}

/**
 * Raw cylinder metadata query from Supabase or fallback
 */
async function getCylinderTypesRaw(): Promise<CylinderType[]> {
  assertBackendAccess();

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('cylinder_types').select('*').eq('is_active', true).order('weight_kg');
    if (error) throw new Error('Supabase cylinder_types query failed: ' + error.message);
    if (data && data.length > 0) return data as CylinderType[];
  }

  if (isMockModeAllowed()) {
    return getLocal<CylinderType[]>('cylinder_types', []);
  }

  throw new SupabaseNotConfiguredError();
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

  if (isSupabaseConfigured()) {
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
  }

  if (isMockModeAllowed()) {
    let list = getLocal<Customer[]>('customers', []);
    // Exclude soft-deleted
    list = list.filter((c) => !c.deleted_at);
    if (activeOnly) list = list.filter((c) => c.is_active);
    if (type !== 'all') list = list.filter((c) => c.customer_type === type);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.customer_code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.company_name && c.company_name.toLowerCase().includes(q)) ||
          c.phone.includes(q)
      );
    }
    const total = list.length;
    const start = (page - 1) * limit;
    const paginated = list.slice(start, start + limit);
    return { customers: paginated, total };
  }

  throw new SupabaseNotConfiguredError();
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
  let purchaseCount = 0;
  let paymentCount = 0;
  let depositCount = 0;
  let deliveryCount = 0;

  if (isSupabaseConfigured()) {
    const [pRes, pyRes, dRes, delRes] = await Promise.all([
      supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
      supabase.from('deposits').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
      supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
    ]);
    purchaseCount = pRes.count || 0;
    paymentCount = pyRes.count || 0;
    depositCount = dRes.count || 0;
    deliveryCount = delRes.count || 0;
  } else if (isMockModeAllowed()) {
    const purchases = getLocal<Purchase[]>('purchases', []).filter((p) => p.customer_id === customerId);
    const payments = getLocal<Payment[]>('payments', []).filter((p) => p.customer_id === customerId);
    const deposits = getLocal<Deposit[]>('deposits', []).filter((d) => d.customer_id === customerId);
    const deliveries = getLocal<Delivery[]>('deliveries', []).filter((d) => d.customer_id === customerId);
    purchaseCount = purchases.length;
    paymentCount = payments.length;
    depositCount = deposits.length;
    deliveryCount = deliveries.length;
  }

  const totalHistoricalRecords = purchaseCount + paymentCount + depositCount + deliveryCount;

  // 2. Decision: Soft Delete vs Permanent Delete
  if (totalHistoricalRecords > 0) {
    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false, deleted_at: now, updated_at: now })
        .eq('id', customerId);
      if (error) throw new Error('Failed to archive customer: ' + error.message);
    }
    if (isMockModeAllowed()) {
      const list = getLocal<Customer[]>('customers', []);
      const updated = list.map((c) =>
        c.id === customerId ? { ...c, is_active: false, deleted_at: now, updated_at: now } : c
      );
      setLocal('customers', updated);
    }

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
    // Permanent SQL Delete
    if (isSupabaseConfigured()) {
      // Cascade delete notes/documents/followups first
      await supabase.from('customer_notes').delete().eq('customer_id', customerId);
      await supabase.from('customer_documents').delete().eq('customer_id', customerId);
      await supabase.from('customer_followups').delete().eq('customer_id', customerId);

      const { error } = await supabase.from('customers').delete().eq('id', customerId);
      if (error) throw new Error('Failed to permanently delete customer: ' + error.message);
    }
    if (isMockModeAllowed()) {
      const list = getLocal<Customer[]>('customers', []);
      setLocal('customers', list.filter((c) => c.id !== customerId));
      const notes = getLocal<CustomerNote[]>('customer_notes', []);
      setLocal('customer_notes', notes.filter((n) => n.customer_id !== customerId));
      const docs = getLocal<CustomerDocument[]>('customer_documents', []);
      setLocal('customer_documents', docs.filter((d) => d.customer_id !== customerId));
    }

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

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (!error && data) return data as Customer;
    if (error && error.code !== 'PGRST116') throw new Error('Supabase get customer failed: ' + error.message);
  }

  if (isMockModeAllowed()) {
    const list = getLocal<Customer[]>('customers', []);
    return list.find((c) => c.id === id) || null;
  }

  throw new SupabaseNotConfiguredError();
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

  if (isSupabaseConfigured()) {
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
  }

  if (isMockModeAllowed()) {
    const code = nextCode('SSG', 'seq_customer');
    const newCust: Customer = {
      ...payload,
      id: 'cust-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      customer_code: code,
      created_at: now,
      updated_at: now,
    };
    const list = getLocal<Customer[]>('customers', []);
    list.unshift(newCust);
    setLocal('customers', list);
    await logAudit('Customer Created', 'customers', newCust.id, { name: newCust.name, code: newCust.customer_code });
    return newCust;
  }

  throw new SupabaseNotConfiguredError();
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

  if (isSupabaseConfigured()) {
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

  // Fallback / Mock Sandbox path
  const customer = await createCustomer({
    customer_type: payload.customer_type,
    name: payload.name,
    company_name: payload.company_name || null,
    contact_person_name: payload.contact_person_name || null,
    phone: payload.phone,
    alternate_phone: payload.alternate_phone || null,
    area1: payload.area1 || null,
    area2: payload.area2 || null,
    street: payload.street || null,
    landmark: payload.landmark || null,
    city: payload.city || 'Tiruppur',
    pincode: payload.pincode || null,
    district: payload.district || 'Tiruppur',
    latitude: payload.latitude || null,
    longitude: payload.longitude || null,
    notes: payload.notes || null,
    sms_enabled: payload.sms_enabled ?? true,
    whatsapp_enabled: payload.whatsapp_enabled ?? true,
    email_enabled: payload.email_enabled ?? true,
    marketing_enabled: payload.marketing_enabled ?? true,
    is_active: true,
  });

  if (payload.cylinder_type_id && payload.quantity && payload.quantity > 0) {
    const pDate = payload.purchase_date || now.split('T')[0];
    const uPrice = payload.unit_price || 0;
    const totalGas = payload.quantity * uPrice;

    const purchase = await createPurchase({
      customer_id: customer.id,
      purchase_date: pDate,
      notes: 'Initial customer registration purchase',
      items: [
        {
          cylinder_type_id: payload.cylinder_type_id,
          quantity: payload.quantity,
          unit_price: uPrice,
        },
      ],
    });

    if (payload.deposit_amount && payload.deposit_amount > 0) {
      await createDeposit({
        customer_id: customer.id,
        purchase_id: purchase.id,
        amount: payload.deposit_amount,
        status: 'given',
        payment_method: payload.payment_method || 'cash',
        transaction_date: pDate,
        notes: 'Initial security deposit',
      });
    }

    if (payload.payment_amount && payload.payment_amount > 0) {
      await createPayment({
        customer_id: customer.id,
        purchase_id: purchase.id,
        amount: payload.payment_amount,
        payment_method: payload.payment_method || 'cash',
        payment_date: pDate,
        status: payload.payment_amount >= totalGas ? 'paid' : 'partial',
        notes: 'Initial gas payment',
      });
    }
  }

  return customer;
}

export async function updateCustomer(id: string, payload: Partial<Customer>): Promise<Customer> {
  assertBackendAccess();
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const dbPayload = sanitizeCustomerDbPayload(payload);
    const { data, error } = await supabase.from('customers').update({ ...dbPayload, updated_at: now }).eq('id', id).select().single();
    if (!error && data) {
      await logAudit('Customer Updated', 'customers', id, payload);
      return data as Customer;
    }
    if (error) throw new Error('Failed to update customer in Supabase: ' + error.message);
  }

  if (isMockModeAllowed()) {
    const list = getLocal<Customer[]>('customers', []);
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Customer not found');
    
    // Preserve customer_code permanently
    const updated: Customer = {
      ...list[idx],
      ...payload,
      customer_code: list[idx].customer_code,
      updated_at: now,
    };
    list[idx] = updated;
    setLocal('customers', list);
    await logAudit('Customer Updated', 'customers', id, payload);
    return updated;
  }

  throw new SupabaseNotConfiguredError();
}

export async function toggleCustomerActive(id: string, isActive: boolean): Promise<Customer> {
  return updateCustomer(id, { is_active: isActive });
}

// -------------------------------------------------------------
// CUSTOMER DOCUMENTS (PRIVATE SUPABASE BUCKET)
// -------------------------------------------------------------
export async function getCustomerDocuments(customerId: string): Promise<CustomerDocument[]> {
  assertBackendAccess();

  if (isSupabaseConfigured()) {
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
  }

  if (isMockModeAllowed()) {
    const docs = getLocal<CustomerDocument[]>('customer_documents', []);
    return docs.filter((d) => d.customer_id === customerId);
  }

  throw new SupabaseNotConfiguredError();
}

export async function uploadCustomerDocument(customerId: string, file: File, docType: DocumentType): Promise<CustomerDocument> {
  assertBackendAccess();

  const fileExt = file.name.split('.').pop();
  const filePath = `${customerId}/${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${fileExt}`;
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
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
  }

  if (isMockModeAllowed()) {
    const newDoc: CustomerDocument = {
      id: 'doc-' + Date.now(),
      customer_id: customerId,
      document_type: docType,
      storage_path: filePath,
      original_filename: file.name,
      mime_type: file.type,
      file_size: file.size,
      uploaded_at: now,
      signed_url: URL.createObjectURL(file),
    };
    const docs = getLocal<CustomerDocument[]>('customer_documents', []);
    docs.unshift(newDoc);
    setLocal('customer_documents', docs);
    await logAudit('Document Uploaded', 'customer_documents', newDoc.id, { filename: file.name, docType });
    return newDoc;
  }

  throw new SupabaseNotConfiguredError();
}

export async function deleteCustomerDocument(docId: string, storagePath: string): Promise<void> {
  assertBackendAccess();

  if (isSupabaseConfigured()) {
    const { error: removeStorageErr } = await supabase.storage.from('customer-documents').remove([storagePath]);
    if (removeStorageErr) console.warn('Storage remove object warning:', removeStorageErr.message);

    const { error: deleteTableErr } = await supabase.from('customer_documents').delete().eq('id', docId);
    if (deleteTableErr) throw new Error('Failed to delete document metadata from table: ' + deleteTableErr.message);

    await logAudit('Document Deleted', 'customer_documents', docId, { storagePath });
    return;
  }

  if (isMockModeAllowed()) {
    const docs = getLocal<CustomerDocument[]>('customer_documents', []);
    const updated = docs.filter((d) => d.id !== docId);
    setLocal('customer_documents', updated);
    await logAudit('Document Deleted', 'customer_documents', docId, { storagePath });
    return;
  }

  throw new SupabaseNotConfiguredError();
}

// -------------------------------------------------------------
// PURCHASES & SALES
// -------------------------------------------------------------
export async function getPurchases(params?: { customerId?: string; search?: string }): Promise<Purchase[]> {
  assertBackendAccess();
  const { customerId, search } = params || {};

  if (isSupabaseConfigured()) {
    let query = supabase.from('purchases').select('*, customer:customers(*), items:purchase_items(*, cylinder_type:cylinder_types(*))').order('purchase_date', { ascending: false });
    if (customerId) query = query.eq('customer_id', customerId);
    const { data, error } = await query;
    if (!error && data) return data as Purchase[];
    if (error) throw new Error('Supabase query purchases failed: ' + error.message);
  }

  if (isMockModeAllowed()) {
    let purchases = getLocal<Purchase[]>('purchases', []);
    if (customerId) purchases = purchases.filter((p) => p.customer_id === customerId);
    if (search) {
      const q = search.toLowerCase();
      purchases = purchases.filter((p) => p.purchase_code.toLowerCase().includes(q) || (p.customer && p.customer.name.toLowerCase().includes(q)));
    }
    return purchases;
  }

  throw new SupabaseNotConfiguredError();
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
  const now = new Date().toISOString();

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

  if (isSupabaseConfigured()) {
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
  }

  if (isMockModeAllowed()) {
    const code = nextCode('PUR', 'seq_purchase');
    const purchaseRecord: Purchase = {
      id: 'pur-' + Date.now(),
      purchase_code: code,
      customer_id: payload.customer_id,
      customer: customer || undefined,
      purchase_date: payload.purchase_date,
      total_gas_amount: totalGas,
      notes: payload.notes,
      created_at: now,
      updated_at: now,
      items: itemsPrepared.map((ip, idx) => ({ ...ip, id: 'pi-' + Date.now() + '-' + idx, purchase_id: 'pur-' + Date.now() })),
    };

    const purchases = getLocal<Purchase[]>('purchases', []);
    purchases.unshift(purchaseRecord);
    setLocal('purchases', purchases);

    if (payload.deposit_amount && payload.deposit_amount > 0) {
      await createDeposit({
        customer_id: payload.customer_id,
        purchase_id: purchaseRecord.id,
        amount: payload.deposit_amount,
        status: 'held',
        payment_method: payload.deposit_payment_method || 'cash',
        transaction_date: payload.purchase_date,
        notes: 'Deposit for purchase ' + code,
      });
    }

    if (payload.payment_amount && payload.payment_amount > 0) {
      const isFull = payload.payment_amount >= totalGas;
      await createPayment({
        customer_id: payload.customer_id,
        purchase_id: purchaseRecord.id,
        amount: payload.payment_amount,
        payment_method: payload.payment_method || 'cash',
        payment_date: payload.purchase_date,
        status: isFull ? 'paid' : 'partial',
        notes: 'Payment for purchase ' + code,
      });
    }

    const address = customer ? [customer.street, customer.area1, customer.area2, customer.city].filter(Boolean).join(', ') : 'Customer Address';
    await createDelivery({
      customer_id: payload.customer_id,
      purchase_id: purchaseRecord.id,
      delivery_date: payload.purchase_date,
      delivery_address: address,
      latitude: customer?.latitude || undefined,
      longitude: customer?.longitude || undefined,
      status: payload.delivery_status === 'delivered' ? 'delivered' : 'pending',
      notes: 'Delivery for purchase ' + code,
      items: itemsPrepared.map((i) => ({ cylinder_type_id: i.cylinder_type_id, quantity: i.quantity })),
    });

    await logAudit('Purchase Created', 'purchases', purchaseRecord.id, { code, totalGas });
    return purchaseRecord;
  }

  throw new SupabaseNotConfiguredError();
}

// -------------------------------------------------------------
// DEPOSITS (TRACKED SEPARATELY FROM GAS REVENUE)
// -------------------------------------------------------------
export async function getDeposits(customerId?: string): Promise<Deposit[]> {
  assertBackendAccess();

  if (isSupabaseConfigured()) {
    let query = supabase.from('deposits').select('*, customer:customers(*)').order('transaction_date', { ascending: false });
    if (customerId) query = query.eq('customer_id', customerId);
    const { data, error } = await query;
    if (!error && data) return data as Deposit[];
    if (error) throw new Error('Supabase query deposits failed: ' + error.message);
  }

  if (isMockModeAllowed()) {
    let list = getLocal<Deposit[]>('deposits', []);
    if (customerId) list = list.filter((d) => d.customer_id === customerId);
    return list;
  }

  throw new SupabaseNotConfiguredError();
}

export async function createDeposit(payload: Omit<Deposit, 'id' | 'created_at'>): Promise<Deposit> {
  assertBackendAccess();
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('deposits').insert({ ...payload, created_at: now }).select().single();
    if (!error && data) {
      await logAudit('Deposit Recorded', 'deposits', data.id, { amount: payload.amount, status: payload.status });
      return data as Deposit;
    }
    if (error) throw new Error('Supabase create deposit failed: ' + error.message);
  }

  if (isMockModeAllowed()) {
    const newDep: Deposit = {
      ...payload,
      id: 'dep-' + Date.now(),
      created_at: now,
    };
    const list = getLocal<Deposit[]>('deposits', []);
    list.unshift(newDep);
    setLocal('deposits', list);
    await logAudit('Deposit Recorded', 'deposits', newDep.id, { amount: payload.amount, status: payload.status });
    return newDep;
  }

  throw new SupabaseNotConfiguredError();
}

// -------------------------------------------------------------
// PAYMENTS & OUTSTANDING
// -------------------------------------------------------------
export async function getPayments(customerId?: string): Promise<Payment[]> {
  assertBackendAccess();

  if (isSupabaseConfigured()) {
    let query = supabase.from('payments').select('*, customer:customers(*)').order('payment_date', { ascending: false });
    if (customerId) query = query.eq('customer_id', customerId);
    const { data, error } = await query;
    if (!error && data) return data as Payment[];
    if (error) throw new Error('Supabase query payments failed: ' + error.message);
  }

  if (isMockModeAllowed()) {
    let list = getLocal<Payment[]>('payments', []);
    if (customerId) list = list.filter((p) => p.customer_id === customerId);
    return list;
  }

  throw new SupabaseNotConfiguredError();
}

export async function createPayment(payload: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
  assertBackendAccess();
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('payments').insert({ ...payload, created_at: now }).select().single();
    if (!error && data) {
      await logAudit('Payment Recorded', 'payments', data.id, { amount: payload.amount, method: payload.payment_method });
      return data as Payment;
    }
    if (error) throw new Error('Supabase create payment failed: ' + error.message);
  }

  if (isMockModeAllowed()) {
    const newPay: Payment = {
      ...payload,
      id: 'pay-' + Date.now(),
      created_at: now,
    };
    const list = getLocal<Payment[]>('payments', []);
    list.unshift(newPay);
    setLocal('payments', list);
    await logAudit('Payment Recorded', 'payments', newPay.id, { amount: payload.amount, method: payload.payment_method });
    return newPay;
  }

  throw new SupabaseNotConfiguredError();
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

  if (isSupabaseConfigured()) {
    let query = supabase.from('cylinders').select('*, cylinder_type:cylinder_types(*), current_customer:customers(*)');
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (!error && data) return data as Cylinder[];
    if (error) throw new Error('Supabase query cylinders failed: ' + error.message);
  }

  if (isMockModeAllowed()) {
    let list = getLocal<Cylinder[]>('cylinders', []);
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);
    return list;
  }

  throw new SupabaseNotConfiguredError();
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

  if (isSupabaseConfigured()) {
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
    return;
  }

  if (isMockModeAllowed()) {
    const purchases = getLocal<Purchase[]>('purchases', []).filter((p) => p.customer_id === payload.customer_id);
    let totalPurchased = 0;
    purchases.forEach((p) => {
      p.items?.forEach((it) => {
        if (it.cylinder_type_id === payload.cylinder_type_id) totalPurchased += it.quantity;
      });
    });
    const priorMovements = getLocal<CylinderMovement[]>('cylinder_movements', []).filter((m) => m.customer_id === payload.customer_id && m.movement_type === 'returned');
    let totalReturned = 0;
    priorMovements.forEach((m) => {
      const qtyMatch = m.notes?.match(/Returned\s+(\d+)\s+cylinders/i);
      totalReturned += qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    });
    const activeHolding = Math.max(0, totalPurchased - totalReturned);
    if (qtyToReturn > activeHolding) {
      throw new Error(`Cannot return ${qtyToReturn} cylinders. Customer only holds ${activeHolding} active cylinders on record.`);
    }

    const movements = getLocal<CylinderMovement[]>('cylinder_movements', []);
    movements.unshift({
      id: 'cm-' + Date.now(),
      cylinder_id: 'batch',
      customer_id: payload.customer_id,
      movement_type: 'returned',
      movement_date: now,
      notes: `Returned ${qtyToReturn} cylinders (${payload.condition}): ${payload.notes || ''}`,
    });
    setLocal('cylinder_movements', movements);
    await logAudit('Cylinder Returned', 'cylinders', payload.customer_id, payload);
    return;
  }

  throw new SupabaseNotConfiguredError();
}

// Dynamic breakdown of cylinder stock across canonical sizes (4 kg, 12 kg, 17 kg, 21 kg)
export async function getCylinderStockSummary(): Promise<CylinderStockSummary[]> {
  const types = await getCylinderTypes();
  const purchases = await getPurchases();
  const deliveries = await getDeliveries();

  // Aggregate supplier stock intake
  const supplierIntakeMap: Record<string, number> = {};
  try {
    const { getSupplierPurchases } = await import('./supplierDb');
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
    if (isSupabaseConfigured()) {
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
    }
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
    const baseInitial = type.weight_kg === 12 ? 150 : type.weight_kg === 21 ? 80 : type.weight_kg === 17 ? 60 : 40;
    const baseTotal = baseInitial + supplierIntake;

    // Available Full Stock = Total Owned - In Delivery - Pending Allocated - With Customer - Empty in Warehouse
    const available = Math.max(0, baseTotal - pendingAllocated - inDelivery - withCustomer - empty);

    return {
      size: type.name,
      available,
      withCustomer,
      empty,
      inDelivery,
      total: available + withCustomer + empty + inDelivery, // Conserved total equal to baseTotal
    };
  });
}

// -------------------------------------------------------------
// DELIVERIES & FIELD WORKFLOW
// -------------------------------------------------------------
export async function getDeliveries(params?: { status?: DeliveryStatus; date?: string; customerId?: string }): Promise<Delivery[]> {
  assertBackendAccess();
  const { status, date, customerId } = params || {};

  if (isSupabaseConfigured()) {
    let query = supabase.from('deliveries').select('*, customer:customers(*), items:delivery_items(*, cylinder_type:cylinder_types(*))').order('delivery_date', { ascending: false });
    if (status) query = query.eq('status', status);
    if (date) query = query.eq('delivery_date', date);
    if (customerId) query = query.eq('customer_id', customerId);
    const { data, error } = await query;
    if (!error && data) return data as Delivery[];
    if (error) throw new Error('Supabase query deliveries failed: ' + error.message);
  }

  if (isMockModeAllowed()) {
    let list = getLocal<Delivery[]>('deliveries', []);
    if (status) list = list.filter((d) => d.status === status);
    if (date) list = list.filter((d) => d.delivery_date === date);
    if (customerId) list = list.filter((d) => d.customer_id === customerId);
    return list;
  }

  throw new SupabaseNotConfiguredError();
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
  const now = new Date().toISOString();
  const customer = await getCustomerById(payload.customer_id);

  if (isSupabaseConfigured()) {
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
  }

  if (isMockModeAllowed()) {
    const code = nextCode('DEL', 'seq_delivery');
    const deliveryRecord: Delivery = {
      id: 'del-' + Date.now(),
      delivery_code: code,
      customer_id: payload.customer_id,
      customer: customer || undefined,
      purchase_id: payload.purchase_id,
      delivery_date: payload.delivery_date,
      delivery_address: payload.delivery_address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      status: payload.status || 'pending',
      notes: payload.notes,
      created_at: now,
      updated_at: now,
      items: payload.items?.map((i, idx) => ({ ...i, id: 'di-' + Date.now() + '-' + idx })),
    };

    const deliveries = getLocal<Delivery[]>('deliveries', []);
    deliveries.unshift(deliveryRecord);
    setLocal('deliveries', deliveries);
    await logAudit('Delivery Scheduled', 'deliveries', deliveryRecord.id, { code });
    return deliveryRecord;
  }

  throw new SupabaseNotConfiguredError();
}

export async function updateDeliveryStatus(id: string, newStatus: DeliveryStatus, notes?: string): Promise<Delivery> {
  assertBackendAccess();
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('deliveries').update({ status: newStatus, notes, updated_at: now }).eq('id', id).select().single();
    if (!error && data) {
      await logAudit('Delivery Status Changed', 'deliveries', id, { newStatus });
      return data as Delivery;
    }
    if (error) throw new Error('Supabase update delivery status failed: ' + error.message);
  }

  if (isMockModeAllowed()) {
    const deliveries = getLocal<Delivery[]>('deliveries', []);
    const idx = deliveries.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error('Delivery not found');
    const updated: Delivery = {
      ...deliveries[idx],
      status: newStatus,
      notes: notes || deliveries[idx].notes,
      updated_at: now,
    };
    deliveries[idx] = updated;
    setLocal('deliveries', deliveries);
    await logAudit('Delivery Status Changed', 'deliveries', id, { newStatus });
    return updated;
  }

  throw new SupabaseNotConfiguredError();
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
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
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
    return;
  }

  if (isMockModeAllowed()) {
    const logs = getLocal<AuditLog[]>('audit_logs', []);
    logs.unshift({
      id: 'log-' + Date.now(),
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      created_at: now,
    });
    setLocal('audit_logs', logs.slice(0, 200));
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  assertBackendAccess();

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
    if (!error && data) return data as AuditLog[];
  }

  if (isMockModeAllowed()) {
    return getLocal<AuditLog[]>('audit_logs', []);
  }

  throw new SupabaseNotConfiguredError();
}

// Seed demo data ONLY if isMockModeAllowed() is true and database is empty
export async function seedDemoDataIfEmpty(): Promise<void> {
  if (!isMockModeAllowed()) return;
  const existing = await getCustomers({ limit: 1 });
  if (existing.total > 0) return;

  const c1 = await createCustomer({
    customer_type: 'company',
    name: 'ABC Grand Hotel & Restaurant',
    company_name: 'ABC Grand Hotel & Restaurant',
    contact_person_name: 'Rajesh Kumar',
    phone: '+91 9876543210',
    alternate_phone: '+91 9876543211',
    area1: 'Fairlands',
    area2: 'Main Road',
    street: '14/B Commercial Complex',
    landmark: 'Near New Bus Stand',
    city: 'Salem',
    pincode: '636016',
    latitude: 11.6643,
    longitude: 78.146,
    notes: 'Requires 21kg commercial cylinders twice a week.',
    is_active: true,
  });

  const c2 = await createCustomer({
    customer_type: 'individual',
    name: 'Senthil Nathan',
    phone: '+91 9443212345',
    area1: 'Suramangalam',
    street: '45 Gandhi Nagar 2nd Street',
    landmark: 'Opposite State Bank ATM',
    city: 'Salem',
    pincode: '636005',
    latitude: 11.6781,
    longitude: 78.1142,
    notes: 'Domestic 14.2kg/12kg customer.',
    is_active: true,
  });

  await createCustomer({
    customer_type: 'company',
    name: 'Sri Krishna Sweets & Bakery',
    company_name: 'Sri Krishna Sweets & Bakery',
    contact_person_name: 'Kandasamy V',
    phone: '+91 9842155667',
    area1: 'Four Roads',
    street: '88 Market Road',
    city: 'Salem',
    pincode: '636009',
    latitude: 11.6582,
    longitude: 78.1561,
    notes: 'Heavy commercial user (17kg & 21kg).',
    is_active: true,
  });

  // Seed initial purchases & transactions
  const types = await getCylinderTypes();
  const type21 = findCylinderTypeByWeight(types, 21)?.id || types[0]?.id || '';
  const type17 = findCylinderTypeByWeight(types, 17)?.id || types[0]?.id || '';
  const type12 = findCylinderTypeByWeight(types, 12)?.id || types[0]?.id || '';

  await createPurchase({
    customer_id: c1.id,
    purchase_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [
      { cylinder_type_id: type21, quantity: 3, unit_price: 3152 },
      { cylinder_type_id: type17, quantity: 1, unit_price: 2552 },
    ],
    deposit_amount: 11500,
    deposit_payment_method: 'bank_transfer',
    payment_amount: 12008,
    payment_method: 'upi',
    delivery_status: 'delivered',
    notes: 'Initial bulk order for ABC Grand Hotel',
  });

  await createPurchase({
    customer_id: c2.id,
    purchase_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [{ cylinder_type_id: type12, quantity: 1, unit_price: 1700 }],
    deposit_amount: 2000,
    deposit_payment_method: 'cash',
    payment_amount: 1700,
    payment_method: 'cash',
    delivery_status: 'pending',
    notes: 'Commercial cylinder refill',
  });
}

// -------------------------------------------------------------
// CRM TIMELINE, NOTES & FOLLOW-UPS
// -------------------------------------------------------------
export async function getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  assertBackendAccess();
  if (isSupabaseConfigured()) {
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
  }

  if (isMockModeAllowed()) {
    const notes = getLocal<CustomerNote[]>(`notes_${customerId}`, []);
    return notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

  if (isSupabaseConfigured()) {
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

  if (isMockModeAllowed()) {
    const notes = getLocal<CustomerNote[]>(`notes_${customerId}`, []);
    notes.unshift(newNote);
    setLocal(`notes_${customerId}`, notes);
    await logAudit('customer_note_added', 'customers', customerId, { note, created_by_name: createdByName });
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

