/**
 * SRI SS GAS AGENCY — Production Storage Sanitizer
 * 
 * Safely removes legacy client-side localStorage business records that may
 * remain from historical development preview deployments, while strictly
 * preserving Supabase authentication sessions and UI theme preferences.
 */
export function purgeLegacyLocalStorageBusinessData(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const legacyPrefixes = [
      'srissgas_customers',
      'srissgas_purchases',
      'srissgas_purchase_items',
      'srissgas_payments',
      'srissgas_deposits',
      'srissgas_deliveries',
      'srissgas_delivery_items',
      'srissgas_supplier_purchases',
      'srissgas_supplier_purchase_items',
      'srissgas_cylinders',
      'srissgas_audit_logs',
      'srissgas_notes',
      'srissgas_docs',
      'srissgas_followups',
      'srissgas_settings',
      'notes_',
      'doc_',
      'followup_',
    ];

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Strictly preserve Supabase auth tokens and UI theme preference
      if (
        key === 'srissgas_theme_v2' ||
        key.startsWith('sb-') ||
        key.includes('auth-token') ||
        key.includes('supabase.auth')
      ) {
        continue;
      }

      if (legacyPrefixes.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch (e) {
    // Non-blocking
  }
}
