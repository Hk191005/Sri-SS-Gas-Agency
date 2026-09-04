/**
 * SRI SS GAS AGENCY — Customer Communication & Refill Reminder Engine
 * Handles message campaigns, festival greetings, dynamic variable rendering,
 * refill reminder scheduling, deduplication protection, and provider abstraction.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { getCustomers, getCylinderTypes, getAgencySettings, getPurchases } from './db';
import { AGENCY_BRANDING } from './constants';
import type {
  Customer,
  CustomerMessage,
  CustomerMessageTemplate,
  CustomerReminderCycle,
  CustomerCommunicationLog,
  MessageType,
  MessageStatus,
  ReminderStatus,
  AgencySettings,
} from '../types/database.types';

const MOCK_STORAGE_KEY_TEMPLATES = 'srissgas_msg_templates';
const MOCK_STORAGE_KEY_MESSAGES = 'srissgas_msg_history';
const MOCK_STORAGE_KEY_LOGS = 'srissgas_msg_logs';

const memoryStore = new Map<string, string>();

function getLocal<T>(key: string, defaultValue: T): T {
  try {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    }
    const mem = memoryStore.get(key);
    return mem ? JSON.parse(mem) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      memoryStore.set(key, JSON.stringify(value));
    }
  } catch (e) {
    console.error('Failed to save to local persistence:', e);
  }
}

// Default Seed Templates
export const DEFAULT_MESSAGE_TEMPLATES: CustomerMessageTemplate[] = [
  {
    id: 'tmpl-refill-1',
    title: 'Standard Refill Reminder',
    category: 'refill_reminder',
    channel: 'all',
    subject: 'LPG Refill Reminder — SRI SS GAS AGENCY',
    body: 'Dear {{customer_name}}, your {{cylinder_type}} gas cylinder refill is expected soon (due {{next_refill_date}}). Please place your refill order with SRI SS GAS AGENCY before your current cylinder runs out. Call {{agency_phone}}. Thank you.',
    is_active: true,
  },
  {
    id: 'tmpl-pongal-1',
    title: 'Happy Pongal Greetings & Delivery Notice',
    category: 'festival',
    channel: 'all',
    subject: 'Happy Pongal from SRI SS GAS AGENCY',
    body: 'Dear {{customer_name}}, SRI SS GAS AGENCY wishes you and your family a very happy and prosperous Pongal! Please book your cylinder refills in advance as delivery schedules may be adjusted during holidays. Helpline: {{agency_phone}}.',
    is_active: true,
  },
  {
    id: 'tmpl-diwali-1',
    title: 'Happy Deepavali Wishes',
    category: 'festival',
    channel: 'all',
    subject: 'Happy Deepavali — SRI SS GAS AGENCY',
    body: 'Dear {{customer_name}}, Wishing you a joyous and safe Deepavali! May this festival of lights bring health, peace and prosperity. For LPG orders and emergency support, contact {{agency_phone}}.',
    is_active: true,
  },
  {
    id: 'tmpl-tamizh-1',
    title: 'Tamil New Year Greetings',
    category: 'festival',
    channel: 'all',
    subject: 'Iniya Tamizh Puthandu Nalvaazhthukkal',
    body: 'Dear {{customer_name}}, SRI SS GAS AGENCY wishes you a joyful and blessed Tamil New Year. We thank you for your valued association with our agency. Helpline: {{agency_phone}}.',
    is_active: true,
  },
  {
    id: 'tmpl-independence-1',
    title: 'Independence Day Greeting',
    category: 'festival',
    channel: 'all',
    subject: 'Happy Independence Day — SRI SS GAS AGENCY',
    body: 'Dear {{customer_name}}, Wishing you a proud and Happy Independence Day! SRI SS GAS AGENCY is dedicated to powering homes and commercial kitchens with safe and reliable LPG service.',
    is_active: true,
  },
  {
    id: 'tmpl-service-1',
    title: 'Holiday / Service Update',
    category: 'announcement',
    channel: 'all',
    subject: 'Service Notice — SRI SS GAS AGENCY',
    body: 'Dear {{customer_name}}, Please note that our delivery fleet will be operating on special holiday hours this week. Kindly book your refill requests early at {{agency_phone}}.',
    is_active: true,
  },
  {
    id: 'tmpl-price-1',
    title: 'Rate Revision Announcement',
    category: 'announcement',
    channel: 'all',
    subject: 'Price Notification — SRI SS GAS AGENCY',
    body: 'Dear {{customer_name}}, Please be informed that cylinder refill rates have been updated per official guidelines. For current tariff details or booking, contact {{agency_phone}}.',
    is_active: true,
  },
];

/**
 * Replace template variables with actual customer and agency data.
 * Guarantees zero "undefined" or "null" in rendered output.
 */
export function renderTemplateVariables(
  templateText: string,
  variables: {
    customer_name?: string;
    customer_code?: string;
    cylinder_type?: string;
    last_order_date?: string;
    next_refill_date?: string;
    outstanding_balance?: number | string;
    agency_name?: string;
    agency_phone?: string;
    agency_address?: string;
  }
): string {
  if (!templateText) return '';

  const agencyName = variables.agency_name || AGENCY_BRANDING.NAME;
  const agencyPhone = variables.agency_phone || AGENCY_BRANDING.DEFAULT_PHONE;
  const customerName = variables.customer_name || 'Valued Customer';
  const customerCode = variables.customer_code || '';
  const cylinderType = variables.cylinder_type || 'Gas';
  const lastOrderDate = variables.last_order_date || 'Recent';
  const nextRefillDate = variables.next_refill_date || 'Soon';
  const balance = variables.outstanding_balance !== undefined ? String(variables.outstanding_balance) : '0';

  return templateText
    .replace(/\{\{customer_name\}\}/gi, customerName)
    .replace(/\{\{customer_code\}\}/gi, customerCode)
    .replace(/\{\{cylinder_type\}\}/gi, cylinderType)
    .replace(/\{\{last_order_date\}\}/gi, lastOrderDate)
    .replace(/\{\{last_refill_date\}\}/gi, lastOrderDate)
    .replace(/\{\{next_refill_date\}\}/gi, nextRefillDate)
    .replace(/\{\{next_order_date\}\}/gi, nextRefillDate)
    .replace(/\{\{outstanding_balance\}\}/gi, `₹${balance}`)
    .replace(/\{\{agency_name\}\}/gi, agencyName)
    .replace(/\{\{agency_phone\}\}/gi, agencyPhone)
    .replace(/\{\{agency_address\}\}/gi, variables.agency_address || AGENCY_BRANDING.DEFAULT_ADDRESS);
}

/**
 * Fetch Message Templates
 */
export async function getCustomerMessageTemplates(): Promise<CustomerMessageTemplate[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('customer_message_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as CustomerMessageTemplate[];
      }
    } catch (e) {
      console.warn('Supabase getCustomerMessageTemplates fell back to defaults:', e);
    }
  }

  return getLocal<CustomerMessageTemplate[]>(MOCK_STORAGE_KEY_TEMPLATES, DEFAULT_MESSAGE_TEMPLATES);
}

/**
 * Fetch Message History
 */
export async function getCustomerMessageHistory(filters?: {
  customerId?: string;
  messageType?: MessageType;
  channel?: string;
  limit?: number;
}): Promise<CustomerMessage[]> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase
        .from('customer_messages')
        .select('*, customer:customers(name, customer_code, phone)')
        .order('created_at', { ascending: false });

      if (filters?.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }
      if (filters?.messageType) {
        query = query.eq('message_type', filters.messageType);
      }
      if (filters?.channel) {
        query = query.eq('channel', filters.channel);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data as CustomerMessage[];
      }
    } catch (e) {
      console.warn('Supabase getCustomerMessageHistory fell back to local store:', e);
    }
  }

  let list = getLocal<CustomerMessage[]>(MOCK_STORAGE_KEY_MESSAGES, []);
  if (filters?.customerId) {
    list = list.filter((m) => m.customer_id === filters.customerId);
  }
  if (filters?.messageType) {
    list = list.filter((m) => m.message_type === filters.messageType);
  }
  if (filters?.channel) {
    list = list.filter((m) => m.channel === filters.channel);
  }
  return list;
}

/**
 * Check if a reminder has already been logged for a customer's specific refill cycle.
 */
export async function isDuplicateReminder(deduplicationKey: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('customer_communication_logs')
        .select('id')
        .eq('deduplication_key', deduplicationKey)
        .limit(1);

      if (!error && data && data.length > 0) {
        return true;
      }
    } catch (e) {
      // Fall through to local check
    }
  }

  const logs = getLocal<CustomerCommunicationLog[]>(MOCK_STORAGE_KEY_LOGS, []);
  return logs.some((l) => l.deduplication_key === deduplicationKey);
}

/**
 * Records a communication log with unique deduplication key
 */
async function logCommunicationRecord(payload: {
  customer_id?: string;
  message_id?: string;
  communication_type: MessageType;
  channel: string;
  deduplication_key: string;
  status: MessageStatus;
}) {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('customer_communication_logs').insert([
        {
          customer_id: payload.customer_id || null,
          message_id: payload.message_id || null,
          communication_type: payload.communication_type,
          channel: payload.channel,
          deduplication_key: payload.deduplication_key,
          status: payload.status,
          sent_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      // Non-blocking
    }
  }

  const logs = getLocal<CustomerCommunicationLog[]>(MOCK_STORAGE_KEY_LOGS, []);
  logs.unshift({
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    customer_id: payload.customer_id,
    message_id: payload.message_id,
    communication_type: payload.communication_type,
    channel: payload.channel,
    deduplication_key: payload.deduplication_key,
    status: payload.status,
    sent_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
  setLocal(MOCK_STORAGE_KEY_LOGS, logs);
}

/**
 * Provider Abstraction: sendCustomerMessage()
 * Safely creates message records and logs without fabricating external delivery.
 */
export async function sendCustomerMessage(payload: {
  customer: Customer;
  message_type: MessageType;
  channel: 'sms' | 'whatsapp' | 'email';
  subject?: string;
  body: string;
  scheduled_at?: string;
  campaign_id?: string;
  deduplication_key?: string;
}): Promise<{ success: boolean; message: CustomerMessage; providerStatus: string }> {
  // Check customer opt-out
  if (payload.channel === 'sms' && payload.customer.sms_enabled === false) {
    throw new Error(`Customer ${payload.customer.name} has disabled SMS communication.`);
  }
  if (payload.channel === 'whatsapp' && payload.customer.whatsapp_enabled === false) {
    throw new Error(`Customer ${payload.customer.name} has disabled WhatsApp communication.`);
  }
  if (payload.channel === 'email' && payload.customer.email_enabled === false) {
    throw new Error(`Customer ${payload.customer.name} has disabled Email communication.`);
  }
  if (
    (payload.message_type === 'festival' || payload.message_type === 'announcement') &&
    payload.customer.marketing_enabled === false
  ) {
    throw new Error(`Customer ${payload.customer.name} has opted out of marketing/festival communications.`);
  }

  // Deduplication check
  if (payload.deduplication_key) {
    const isDup = await isDuplicateReminder(payload.deduplication_key);
    if (isDup) {
      throw new Error('A reminder has already been prepared/sent for this refill cycle.');
    }
  }

  // Current status: "pending_provider" (prepared for external gateway connection)
  const initialStatus: MessageStatus = payload.scheduled_at ? 'draft' : 'pending_provider';

  const newRecord: CustomerMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    customer_id: payload.customer.id,
    recipient_name: payload.customer.name,
    recipient_phone: payload.customer.phone,
    recipient_email: (payload.customer as any).email || null,
    message_type: payload.message_type,
    channel: payload.channel,
    subject: payload.subject || null,
    body: payload.body,
    status: initialStatus,
    scheduled_at: payload.scheduled_at || null,
    sent_at: payload.scheduled_at ? null : new Date().toISOString(),
    campaign_id: payload.campaign_id || null,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || null;

      const { data, error } = await supabase
        .from('customer_messages')
        .insert([
          {
            customer_id: payload.customer.id,
            recipient_name: payload.customer.name,
            recipient_phone: payload.customer.phone,
            recipient_email: (payload.customer as any).email || null,
            message_type: payload.message_type,
            channel: payload.channel,
            subject: payload.subject || null,
            body: payload.body,
            status: initialStatus,
            scheduled_at: payload.scheduled_at || null,
            sent_at: payload.scheduled_at ? null : new Date().toISOString(),
            campaign_id: payload.campaign_id || null,
            created_by: userId,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        newRecord.id = data.id;
      }
    } catch (e) {
      console.warn('Supabase customer_messages insert fell back to local store:', e);
    }
  }

  // Record in local store
  const messages = getLocal<CustomerMessage[]>(MOCK_STORAGE_KEY_MESSAGES, []);
  messages.unshift(newRecord);
  setLocal(MOCK_STORAGE_KEY_MESSAGES, messages);

  // Record communication log
  const dedupKey =
    payload.deduplication_key ||
    `msg_${payload.customer.id}_${payload.message_type}_${new Date().toISOString().split('T')[0]}_${Math.random().toString(36).substring(2, 6)}`;

  await logCommunicationRecord({
    customer_id: payload.customer.id,
    message_id: newRecord.id,
    communication_type: payload.message_type,
    channel: payload.channel,
    deduplication_key: dedupKey,
    status: initialStatus,
  });

  return {
    success: true,
    message: newRecord,
    providerStatus: 'Message prepared. External gateway integration pending.',
  };
}

/**
 * Bulk Campaign Dispatcher
 */
export async function createCustomerCampaign(payload: {
  title?: string;
  message_type: MessageType;
  channel: 'sms' | 'whatsapp' | 'email';
  subject?: string;
  bodyTemplate: string;
  recipients: Customer[];
  scheduled_at?: string;
}): Promise<{ total: number; successful: number; skipped: number; errors: string[] }> {
  const campaignId = `camp-${Date.now()}`;
  let successful = 0;
  let skipped = 0;
  const errors: string[] = [];

  const agencySettings = await getAgencySettings();

  for (const customer of payload.recipients) {
    // 1. Exclude soft-deleted/archived customers
    if (customer.deleted_at || !customer.is_active) {
      skipped++;
      continue;
    }

    // 2. Check marketing opt-out
    if (
      (payload.message_type === 'festival' || payload.message_type === 'announcement') &&
      customer.marketing_enabled === false
    ) {
      skipped++;
      continue;
    }

    // 3. Render body template
    const renderedBody = renderTemplateVariables(payload.bodyTemplate, {
      customer_name: customer.name,
      customer_code: customer.customer_code,
      agency_name: agencySettings.agency_name,
      agency_phone: agencySettings.phone,
    });

    try {
      await sendCustomerMessage({
        customer,
        message_type: payload.message_type,
        channel: payload.channel,
        subject: payload.subject,
        body: renderedBody,
        scheduled_at: payload.scheduled_at,
        campaign_id: campaignId,
      });
      successful++;
    } catch (err: any) {
      errors.push(`${customer.name}: ${err.message}`);
      skipped++;
    }
  }

  return {
    total: payload.recipients.length,
    successful,
    skipped,
    errors,
  };
}

/**
 * Calculate Customer Refill Timing based on actual purchase history.
 */
export function calculateCustomerRefillStatus(
  customer: Customer,
  lastPurchaseDateStr: string | null,
  cylinderWeightKg: number,
  settings: AgencySettings
): {
  expectedRefillDate: string;
  daysUntilRefill: number;
  reminderStatus: ReminderStatus;
  intervalDays: number;
  leadDays: number;
} {
  // Determine canonical interval based on cylinder weight
  let intervalDays = 30; // default
  let leadDays = 3;

  if (cylinderWeightKg === 4) {
    intervalDays = settings.reminder_interval_4kg || 14; // 14 days for 4kg Domestic
    leadDays = settings.reminder_lead_days_4kg || 2;
  } else if (cylinderWeightKg === 12) {
    intervalDays = settings.reminder_interval_12kg || 30; // 30 days for 12kg Commercial
    leadDays = settings.reminder_lead_days_12kg || 3;
  } else if (cylinderWeightKg === 17) {
    intervalDays = settings.reminder_interval_17kg || 60; // 60 days for 17kg Commercial
    leadDays = settings.reminder_lead_days_17kg || 5;
  } else if (cylinderWeightKg === 21) {
    intervalDays = settings.reminder_interval_21kg || 60; // Configurable 60-90 days for 21kg Industrial
    leadDays = settings.reminder_lead_days_21kg || 5;
  }

  // Base date is the customer's actual latest refill purchase date
  const baseDate = lastPurchaseDateStr ? new Date(lastPurchaseDateStr) : new Date(customer.created_at || Date.now());
  const expectedDate = new Date(baseDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  const expectedRefillDate = expectedDate.toISOString().split('T')[0];

  // Calculate day difference from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(expectedRefillDate);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const daysUntilRefill = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let reminderStatus: ReminderStatus = 'upcoming';

  if (daysUntilRefill < 0) {
    reminderStatus = 'overdue';
  } else if (daysUntilRefill <= 1) {
    reminderStatus = 'due'; // Due today or tomorrow
  } else if (daysUntilRefill <= leadDays) {
    reminderStatus = 'upcoming';
  } else {
    reminderStatus = 'recently_refilled';
  }

  return {
    expectedRefillDate,
    daysUntilRefill,
    reminderStatus,
    intervalDays,
    leadDays,
  };
}

/**
 * Evaluate all active customers for refill reminder cycles
 */
export async function getCustomerReminderCycles(): Promise<CustomerReminderCycle[]> {
  const [custRes, cylinderTypes, settings, purchases] = await Promise.all([
    getCustomers({ activeOnly: true, limit: 1000 }),
    getCylinderTypes(),
    getAgencySettings(),
    getPurchases(),
  ]);

  const cycles: CustomerReminderCycle[] = [];

  for (const customer of custRes.customers) {
    // Exclude archived/deleted customers
    if (customer.deleted_at || !customer.is_active) continue;

    // Find customer's latest completed purchase
    const custPurchases = purchases
      .filter((p) => p.customer_id === customer.id)
      .sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());

    const latestPurchase = custPurchases[0];
    const lastRefillDate = latestPurchase ? latestPurchase.purchase_date : customer.created_at.split('T')[0];

    // Determine cylinder type and weight
    let cylinderTypeId = latestPurchase?.items?.[0]?.cylinder_type_id || cylinderTypes[0]?.id;
    let cylinderType = cylinderTypes.find((c) => c.id === cylinderTypeId) || cylinderTypes[0];
    const weightKg = cylinderType ? cylinderType.weight_kg : 4;

    const { expectedRefillDate, daysUntilRefill, reminderStatus } = calculateCustomerRefillStatus(
      customer,
      lastRefillDate,
      weightKg,
      settings
    );

    const cycleKey = `cycle_${customer.id}_${cylinderTypeId}_${lastRefillDate}`;

    cycles.push({
      id: `rc-${customer.id}`,
      customer_id: customer.id,
      customer,
      cylinder_type_id: cylinderTypeId,
      cylinder_type: cylinderType,
      last_refill_date: lastRefillDate,
      expected_refill_date: expectedRefillDate,
      reminder_status: reminderStatus,
      days_until_refill: daysUntilRefill,
      cycle_key: cycleKey,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return cycles.sort((a, b) => (a.days_until_refill ?? 0) - (b.days_until_refill ?? 0));
}

/**
 * Dispatch Refill Reminder for a specific customer
 */
export async function sendRefillReminderToCustomer(
  customer: Customer,
  cylinderName: string,
  expectedDate: string,
  lastDate: string
): Promise<{ success: boolean; message?: string }> {
  const settings = await getAgencySettings();

  const cycleKey = `reminder_${customer.id}_${lastDate}_${expectedDate}`;

  // Check if reminder was already sent for this exact refill cycle
  const alreadySent = await isDuplicateReminder(cycleKey);
  if (alreadySent) {
    throw new Error('A refill reminder has already been sent for this refill cycle.');
  }

  const defaultReminderTemplate =
    DEFAULT_MESSAGE_TEMPLATES.find((t) => t.category === 'refill_reminder')?.body ||
    'Dear {{customer_name}}, your {{cylinder_type}} gas cylinder refill is expected soon. Please contact SRI SS GAS AGENCY at {{agency_phone}}.';

  const renderedBody = renderTemplateVariables(defaultReminderTemplate, {
    customer_name: customer.name,
    customer_code: customer.customer_code,
    cylinder_type: cylinderName,
    last_order_date: lastDate,
    next_refill_date: expectedDate,
    agency_name: settings.agency_name,
    agency_phone: settings.phone,
  });

  const channel: 'sms' | 'whatsapp' | 'email' = customer.whatsapp_enabled !== false ? 'whatsapp' : 'sms';

  await sendCustomerMessage({
    customer,
    message_type: 'refill_reminder',
    channel,
    subject: 'LPG Refill Reminder — SRI SS GAS AGENCY',
    body: renderedBody,
    deduplication_key: cycleKey,
  });

  return { success: true, message: 'Refill reminder prepared and logged successfully.' };
}
