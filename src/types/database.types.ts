export type CustomerType = 'individual' | 'company';
export type DocumentType =
  | 'aadhaar'
  | 'address_proof'
  | 'gst'
  | 'pan'
  | 'business_reg'
  | 'license'
  | 'other';
export type CylinderStatus = 'available' | 'full' | 'with_customer' | 'empty' | 'in_delivery' | 'damaged' | 'maintenance';
export type DepositStatus = 'given' | 'held' | 'adjusted' | 'refunded';
export type PaymentStatus = 'paid' | 'partial' | 'pending';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other';
export type DeliveryStatus = 'pending' | 'assigned' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type MovementType = 'assigned' | 'delivered' | 'returned' | 'marked_empty' | 'marked_full' | 'maintenance' | 'supplier_stock_in';

export type SupplierPurchaseStatus = 'draft' | 'confirmed' | 'cancelled';
export type ExtractionStatus = 'pending' | 'completed' | 'manual' | 'failed';

export interface AgencySettings {
  id: string;
  agency_name: string;
  subtitle: string;
  phone: string;
  email: string;
  address: string;
  // Selling Prices (Customer Refill)
  default_price_4kg: number;
  default_price_12kg: number;
  default_price_17kg: number;
  default_price_21kg: number;
  default_price_33kg?: number;
  // Buying Prices (Supplier Stock Acquisition)
  default_buying_price_4kg: number;
  default_buying_price_12kg: number;
  default_buying_price_17kg: number;
  default_buying_price_21kg: number;
  default_buying_price_33kg?: number;
  // Security Deposits (Held Cylinder Liability)
  default_deposit_4kg: number;
  default_deposit_12kg: number;
  default_deposit_17kg: number;
  default_deposit_21kg: number;
  default_deposit_33kg?: number;
  // Refill Reminder Rules
  reminder_auto_enabled?: boolean;
  reminder_interval_4kg?: number;
  reminder_interval_12kg?: number;
  reminder_interval_17kg?: number;
  reminder_interval_21kg?: number;
  reminder_interval_33kg?: number;
  reminder_lead_days_4kg?: number;
  reminder_lead_days_12kg?: number;
  reminder_lead_days_17kg?: number;
  reminder_lead_days_21kg?: number;
  reminder_lead_days_33kg?: number;
  // Opening Stock Inventory Defaults (Baseline Full Cylinders in stock)
  opening_stock_4kg?: number;
  opening_stock_12kg?: number;
  opening_stock_17kg?: number;
  opening_stock_21kg?: number;
  opening_stock_33kg?: number;
  // Legacy alias for backward compatibility (read-only from existing database column)
  default_price_5kg?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CylinderFinancialDefaults {
  [weightKg: number]: {
    sellingPrice: number;
    buyingPrice: number;
    securityDeposit: number;
  };
}

export interface CylinderType {
  id: string;
  name: string; // '4 kg', '12 kg', '17 kg', '21 kg'
  weight_kg: number;
  default_price: number; // Selling price (customer refill)
  default_buying_price?: number; // Buying price (supplier stock)
  default_deposit?: number; // Security deposit default
  is_active: boolean;
  created_at?: string;
}

export interface SupplierCompany {
  id: string;
  company_name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  supplier_code?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  customer_code: string; // e.g. SSG-000001
  customer_type: CustomerType;
  name: string;
  company_name?: string | null;
  contact_person_name?: string | null;
  phone: string;
  alternate_phone?: string | null;
  area1?: string | null;
  area2?: string | null;
  street?: string | null;
  landmark?: string | null;
  city?: string | null;
  pincode?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  is_active: boolean;
  deleted_at?: string | null;
  sms_enabled?: boolean;
  whatsapp_enabled?: boolean;
  email_enabled?: boolean;
  marketing_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerDocument {
  id: string;
  customer_id: string;
  document_type: DocumentType;
  storage_path: string;
  original_filename: string;
  mime_type?: string | null;
  file_size?: number | null;
  uploaded_by?: string | null;
  uploaded_at: string;
  signed_url?: string | null;
}

export interface Cylinder {
  id: string;
  cylinder_number: string;
  cylinder_type_id: string;
  cylinder_type?: CylinderType;
  status: CylinderStatus;
  current_customer_id?: string | null;
  current_customer?: Customer | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id?: string;
  purchase_id?: string;
  cylinder_type_id: string;
  cylinder_type?: CylinderType;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Purchase {
  id: string;
  purchase_code: string; // e.g. PUR-000001
  customer_id: string;
  customer?: Customer;
  purchase_date: string;
  total_gas_amount: number;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  items?: PurchaseItem[];
  payments?: Payment[];
  deposits?: Deposit[];
  deliveries?: Delivery[];
}

export interface Deposit {
  id: string;
  customer_id: string;
  customer?: Customer;
  purchase_id?: string | null;
  amount: number;
  status: DepositStatus;
  payment_method: PaymentMethod;
  transaction_date: string;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  customer_id: string;
  customer?: Customer;
  purchase_id?: string | null;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  status: PaymentStatus;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface DeliveryItem {
  id?: string;
  delivery_id?: string;
  cylinder_type_id: string;
  cylinder_type?: CylinderType;
  quantity: number;
}

export interface Delivery {
  id: string;
  delivery_code: string; // e.g. DEL-000001
  customer_id: string;
  customer?: Customer;
  purchase_id?: string | null;
  delivery_date: string;
  delivery_address: string;
  latitude?: number | null;
  longitude?: number | null;
  status: DeliveryStatus;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  items?: DeliveryItem[];
}

export interface CylinderMovement {
  id: string;
  cylinder_id: string;
  cylinder?: Cylinder;
  customer_id?: string | null;
  customer?: Customer | null;
  movement_type: MovementType;
  movement_date: string;
  reference_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
}

export interface SupplierPurchaseItem {
  id?: string;
  supplier_purchase_id?: string;
  cylinder_type_id: string;
  cylinder_type?: CylinderType;
  quantity: number;
  unit_price: number;
  tax_amount?: number;
  total_price: number;
}

export interface SupplierPurchase {
  id: string;
  purchase_code: string; // e.g. SPUR-000001
  supplier_name: string;
  supplier_company_id?: string | null;
  purchase_source?: 'manual' | 'ocr_upload';
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  outstanding_amount: number;
  status: SupplierPurchaseStatus;
  bill_storage_path?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  items?: SupplierPurchaseItem[];
  payments?: SupplierPayment[];
}

export interface SupplierPayment {
  id: string;
  supplier_purchase_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface BillExtraction {
  id: string;
  supplier_purchase_id?: string | null;
  extraction_status: ExtractionStatus;
  raw_extracted_data?: Record<string, any> | null;
  reviewed_data?: Record<string, any> | null;
  confidence?: number | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  individualCustomers: number;
  companyCustomers: number;
  todaysDeliveries: number;
  pendingDeliveries: number;
  thisMonthSales: number;
  outstandingPayments: number;
  totalDepositsHeld: number;
  availableCylinders: number;
  supplierPurchasesMonth: number;
  supplierOutstanding: number;
}

export interface InventoryOpeningBalance {
  id: string;
  cylinder_type_id: string;
  opening_full_quantity: number;
  created_at?: string;
  updated_at?: string;
  updated_by?: string | null;
  cylinder_type?: CylinderType;
}

export interface CylinderStockSummary {
  size: string; // '4 kg Domestic', '12 kg', etc.
  cylinder_type_id?: string;
  weight_kg?: number;
  opening_balance?: number;
  available: number;
  withCustomer: number;
  empty: number;
  inDelivery: number;
  total: number;
}

export interface CreateCustomerWithInitialGasInput {
  customer_type: CustomerType;
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
  payment_method?: PaymentMethod;
  purchase_date?: string;
}

// -------------------------------------------------------------
// CUSTOMER COMMUNICATION & REFILL REMINDERS
// -------------------------------------------------------------
export type MessageType = 'refill_reminder' | 'festival' | 'announcement' | 'service' | 'custom';
export type MessageChannel = 'sms' | 'whatsapp' | 'email' | 'all';
export type MessageStatus = 'draft' | 'prepared' | 'pending_provider' | 'sent' | 'delivered' | 'failed' | 'cancelled';
export type ReminderStatus = 'recently_refilled' | 'upcoming' | 'due' | 'overdue' | 'dismissed';

export interface CustomerMessageTemplate {
  id: string;
  title: string;
  category: MessageType;
  channel: MessageChannel;
  subject?: string | null;
  body: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerMessage {
  id: string;
  customer_id?: string | null;
  customer?: Customer | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  message_type: MessageType;
  channel: 'sms' | 'whatsapp' | 'email';
  subject?: string | null;
  body: string;
  status: MessageStatus;
  scheduled_at?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  failed_at?: string | null;
  failure_reason?: string | null;
  provider_message_id?: string | null;
  campaign_id?: string | null;
  metadata?: Record<string, any>;
  created_by?: string | null;
  created_at: string;
}

export interface CustomerReminderCycle {
  id: string;
  customer_id: string;
  customer?: Customer;
  cylinder_type_id?: string | null;
  cylinder_type?: CylinderType;
  last_refill_date: string;
  expected_refill_date: string;
  reminder_status: ReminderStatus;
  days_until_refill?: number;
  last_reminder_sent_at?: string | null;
  cycle_key: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerCommunicationLog {
  id: string;
  customer_id?: string | null;
  message_id?: string | null;
  communication_type: MessageType;
  channel: string;
  deduplication_key: string;
  status: MessageStatus;
  sent_at?: string;
  created_at: string;
}

// -------------------------------------------------------------
// CRM EXTENSIONS
// -------------------------------------------------------------
export type FollowUpStatus = 'contacted' | 'not_contacted' | 'interested' | 'will_purchase_later' | 'no_response' | 'completed';
export type FollowUpCategory = 'refill_30' | 'important_60' | 'critical_90' | 'payment_outstanding';

export interface CustomerFollowUp {
  id: string;
  customer_id: string;
  customer?: Customer;
  category: FollowUpCategory;
  status: FollowUpStatus;
  days_inactive: number;
  outstanding_amount: number;
  last_purchase_date?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  note: string;
  created_by_name?: string;
  created_by?: string | null;
  created_at: string;
}

export interface ActivityTimelineItem {
  id: string;
  date: string;
  title: string;
  description: string;
  type: 'customer_created' | 'customer_updated' | 'purchase' | 'payment' | 'deposit' | 'delivery' | 'document' | 'followup' | 'note' | 'message';
  amount?: number;
  status?: string;
  metadata?: Record<string, any>;
}

export interface CustomerMergeStats {
  customer: Customer;
  purchasesCount: number;
  paymentsCount: number;
  depositsCount: number;
  deliveriesCount: number;
  documentsCount: number;
  cylindersCount: number;
  notesCount: number;
  followupsCount: number;
  totalGasPurchases: number;
  totalPayments: number;
  outstanding: number;
}

export interface CustomerMergeResult {
  success: boolean;
  primary_id: string;
  primary_code: string;
  primary_name: string;
  duplicate_id: string;
  duplicate_code: string;
  duplicate_name: string;
  transferred: {
    purchases: number;
    payments: number;
    deposits: number;
    deliveries: number;
    documents: number;
    cylinders: number;
    movements: number;
    notes: number;
    followups: number;
  };
}

