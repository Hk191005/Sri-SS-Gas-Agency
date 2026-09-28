/**
 * SRI SS GAS AGENCY — Central Customer Lifecycle & Status Authority
 * 
 * Defines the single authoritative business rule for customer active status:
 * A customer is active ONLY IF is_active === true AND deleted_at === null (or undefined).
 * 
 * Truth Table:
 * true  + null/undefined => ACTIVE
 * false + timestamp      => INACTIVE
 * true  + timestamp      => INACTIVE (inconsistent legacy state normalized to inactive)
 * false + null/undefined => INACTIVE
 */

export interface CustomerStatusCheckable {
  is_active?: boolean | null;
  deleted_at?: string | null;
}

/**
 * Authoritative central customer status evaluator.
 * Must be used across all modules (Customers, Profile, Billing, Sales, Dashboard, Reports).
 */
export function isCustomerActive(customer?: CustomerStatusCheckable | null): boolean {
  if (!customer) return false;
  return customer.is_active === true && (customer.deleted_at === null || customer.deleted_at === undefined);
}

/**
 * Returns formatted lifecycle label for display in badges and tables.
 */
export function getCustomerStatusLabel(customer?: CustomerStatusCheckable | null): 'Active' | 'Inactive' {
  return isCustomerActive(customer) ? 'Active' : 'Inactive';
}
