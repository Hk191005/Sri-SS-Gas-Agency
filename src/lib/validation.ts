/**
 * SRI SS GAS AGENCY — Business Validation & Normalization Module
 * Enforces Indian phone validation, pincode validation, and financial rules.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  normalized: string;
}

/**
 * Validates a 10-digit Indian mobile phone number.
 * Must begin with 6, 7, 8, or 9 and be exactly 10 numeric digits after stripping +91/country code.
 */
export function validateIndianPhone(input: string, required: boolean = true): ValidationResult {
  if (!input || !input.trim()) {
    if (!required) return { isValid: true, normalized: '' };
    return { isValid: false, error: 'Phone number is required.', normalized: '' };
  }

  // Strip common non-digits or prefixes like +91, 0, spaces, hyphens
  let digitsOnly = input.replace(/\D/g, '');

  // If user entered +91 or 091 prefix, strip country code (91) if string is 12 digits
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    digitsOnly = digitsOnly.substring(2);
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    digitsOnly = digitsOnly.substring(1);
  }

  // Reject anything that is not exactly 10 digits
  if (digitsOnly.length !== 10) {
    return {
      isValid: false,
      error: 'Enter a valid 10-digit Indian mobile number.',
      normalized: digitsOnly,
    };
  }

  // First digit must be 6, 7, 8, or 9
  if (!/^[6-9]/.test(digitsOnly)) {
    return {
      isValid: false,
      error: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
      normalized: digitsOnly,
    };
  }

  // Reject obviously dummy numbers like 0000000000 or 1111111111 (handled by [6-9])
  if (/^(\d)\1{9}$/.test(digitsOnly)) {
    return {
      isValid: false,
      error: 'Enter a valid 10-digit Indian mobile number.',
      normalized: digitsOnly,
    };
  }

  return { isValid: true, normalized: digitsOnly };
}

/**
 * Validates 6-digit Indian Pincode.
 */
export function validateIndianPincode(input: string, required: boolean = false): ValidationResult {
  if (!input || !input.trim()) {
    if (!required) return { isValid: true, normalized: '' };
    return { isValid: false, error: 'Pincode is required.', normalized: '' };
  }

  const digits = input.trim();
  if (!/^[1-9][0-9]{5}$/.test(digits)) {
    return {
      isValid: false,
      error: 'Enter a valid 6-digit Indian pincode.',
      normalized: digits,
    };
  }

  return { isValid: true, normalized: digits };
}

/**
 * Validates numeric quantity (> 0).
 */
export function validateQuantity(quantity: number): { isValid: boolean; error?: string } {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { isValid: false, error: 'Quantity must be a positive whole number.' };
  }
  return { isValid: true };
}

/**
 * Validates price / financial amount (>= 0).
 */
export function validateAmount(amount: number, label: string = 'Amount'): { isValid: boolean; error?: string } {
  if (isNaN(amount) || amount < 0) {
    return { isValid: false, error: `${label} cannot be negative.` };
  }
  return { isValid: true };
}
