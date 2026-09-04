-- SRI SS GAS AGENCY Database Migration Schema
-- Migration: 20260828000008_customer_communication_system.sql
-- Description: Customer Communication Center, Refill Reminders, Marketing Opt-Out, and Multi-Admin Authorization

-- 1. Update is_admin() Security Definer Function for Owner (Harikanth) and Father (Selvaraj)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN (
    auth.uid() IS NOT NULL AND (
      LOWER(COALESCE(auth.jwt() ->> 'email', '')) IN (
        'sshk5318@gmail.com',
        'selvarajkm33@gmail.com',
        'srissgasagency@srissgas.com',
        'srissgasagency@gmail.com'
      ) OR
      LOWER(SPLIT_PART(COALESCE(auth.jwt() ->> 'email', ''), '@', 1)) IN ('srissgasagency', 'sshk5318', 'selvarajkm33') OR
      COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    )
  );
END;
$$;

-- 2. Extend customers with Communication Preferences and Consent
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS marketing_enabled BOOLEAN NOT NULL DEFAULT true;

-- 3. Extend agency_settings with Refill Reminder Rules
ALTER TABLE public.agency_settings
ADD COLUMN IF NOT EXISTS reminder_auto_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS reminder_interval_4kg INTEGER NOT NULL DEFAULT 14,
ADD COLUMN IF NOT EXISTS reminder_interval_12kg INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS reminder_interval_17kg INTEGER NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS reminder_interval_21kg INTEGER NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS reminder_lead_days_4kg INTEGER NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS reminder_lead_days_12kg INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS reminder_lead_days_17kg INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS reminder_lead_days_21kg INTEGER NOT NULL DEFAULT 5;

-- 4. Customer Message Templates Table
CREATE TABLE IF NOT EXISTS public.customer_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'announcement', -- 'refill_reminder' | 'festival' | 'announcement' | 'service' | 'custom'
  channel TEXT NOT NULL DEFAULT 'all', -- 'sms' | 'whatsapp' | 'email' | 'all'
  subject TEXT,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin access customer_message_templates" ON public.customer_message_templates;
CREATE POLICY "Admin access customer_message_templates"
ON public.customer_message_templates FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. Customer Messages & Campaigns Table
CREATE TABLE IF NOT EXISTS public.customer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  recipient_name TEXT,
  recipient_phone TEXT,
  recipient_email TEXT,
  message_type TEXT NOT NULL, -- 'refill_reminder' | 'festival' | 'announcement' | 'service' | 'custom'
  channel TEXT NOT NULL, -- 'sms' | 'whatsapp' | 'email'
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prepared', -- 'draft' | 'prepared' | 'pending_provider' | 'sent' | 'delivered' | 'failed' | 'cancelled'
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  provider_message_id TEXT,
  campaign_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_messages_customer ON public.customer_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_messages_status ON public.customer_messages(status);
CREATE INDEX IF NOT EXISTS idx_customer_messages_type ON public.customer_messages(message_type);

ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin access customer_messages" ON public.customer_messages;
CREATE POLICY "Admin access customer_messages"
ON public.customer_messages FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. Customer Refill Reminder Cycles Table
CREATE TABLE IF NOT EXISTS public.customer_reminder_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  cylinder_type_id UUID REFERENCES public.cylinder_types(id) ON DELETE SET NULL,
  last_refill_date DATE NOT NULL,
  expected_refill_date DATE NOT NULL,
  reminder_status TEXT NOT NULL DEFAULT 'upcoming', -- 'recently_refilled' | 'upcoming' | 'due' | 'overdue' | 'dismissed'
  last_reminder_sent_at TIMESTAMPTZ,
  cycle_key TEXT NOT NULL UNIQUE, -- e.g. "cust-id_cyl-id_2026-08-01"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_reminder_cycles_customer ON public.customer_reminder_cycles(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_reminder_cycles_status ON public.customer_reminder_cycles(reminder_status);

ALTER TABLE public.customer_reminder_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin access customer_reminder_cycles" ON public.customer_reminder_cycles;
CREATE POLICY "Admin access customer_reminder_cycles"
ON public.customer_reminder_cycles FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. Customer Communication Logs & Anti-Spam Deduplication Table
CREATE TABLE IF NOT EXISTS public.customer_communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.customer_messages(id) ON DELETE SET NULL,
  communication_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  deduplication_key TEXT UNIQUE NOT NULL, -- e.g. "reminder_cust-id_cyl-id_2026-08-01_upcoming"
  status TEXT NOT NULL DEFAULT 'prepared',
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_comm_logs_dedup ON public.customer_communication_logs(deduplication_key);

ALTER TABLE public.customer_communication_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin access customer_communication_logs" ON public.customer_communication_logs;
CREATE POLICY "Admin access customer_communication_logs"
ON public.customer_communication_logs FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8. Seed Default Festival & Refill Reminder Templates
INSERT INTO public.customer_message_templates (title, category, channel, subject, body)
VALUES
  (
    'Refill Reminder — Domestic & Commercial',
    'refill_reminder',
    'all',
    'LPG Refill Reminder — SRI SS GAS AGENCY',
    'Dear {{customer_name}}, your {{cylinder_type}} gas cylinder refill may be due soon. Please place your order with SRI SS GAS AGENCY before your current supply runs out. For prompt delivery, call {{agency_phone}}. Thank you.'
  ),
  (
    'Pongal Wishes & Delivery Notice',
    'festival',
    'all',
    'Happy Pongal from SRI SS GAS AGENCY',
    'Dear {{customer_name}}, SRI SS GAS AGENCY wishes you and your family a very happy and prosperous Pongal! Please book your cylinder refills in advance as delivery schedules may be adjusted during holidays. Contact: {{agency_phone}}.'
  ),
  (
    'Diwali Festival Greetings',
    'festival',
    'all',
    'Happy Diwali from SRI SS GAS AGENCY',
    'Dear {{customer_name}}, Wishing you a joyous and safe Deepavali! May this festival of lights bring happiness and prosperity. For emergency LPG assistance, contact SRI SS GAS AGENCY at {{agency_phone}}.'
  ),
  (
    'Tamil New Year Greetings',
    'festival',
    'all',
    'Iniya Tamizh Puthandu Nalvaazhthukkal',
    'Dear {{customer_name}}, SRI SS GAS AGENCY wishes you a joyful Tamil New Year. We thank you for your valued association with our agency.'
  ),
  (
    'Price & Service Update Announcement',
    'announcement',
    'all',
    'Important Service Update — SRI SS GAS AGENCY',
    'Dear {{customer_name}}, Please note the updated cylinder refill rates and delivery schedules effective immediately. For any queries or orders, reach us at {{agency_phone}}.'
  )
ON CONFLICT DO NOTHING;
