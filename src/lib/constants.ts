// SRI SS GAS AGENCY System Constants

export const AGENCY_BRANDING = {
  NAME: 'SRI SS GAS AGENCY',
  SUBTITLE: 'Gas Agency Management System',
  ADMIN_USERNAME: 'srissgasagency',
  ADMIN_EMAIL: 'sshk5318@gmail.com',
  ADMIN_EMAILS: ['sshk5318@gmail.com', 'selvarajkm33@gmail.com'],
  ADMIN_PROFILES: {
    'sshk5318@gmail.com': { name: 'Harikanth', role: 'Agency Owner / Admin' },
    'selvarajkm33@gmail.com': { name: 'Selvaraj', role: 'Executive Administrator' },
  } as Record<string, { name: string; role: string }>,
  DEFAULT_PHONE: '+91 9876543210',
  DEFAULT_ADDRESS: '123 Main Road, Tiruppur, Tamil Nadu, India',
  LOGO_PATH: '/assets/sri-ss-gas-agency-logo.png',
};

export const SUPPORTED_CYLINDER_SIZES = ['4 kg', '12 kg', '17 kg', '21 kg'] as const;

/**
 * Helper to map user input email or username.
 */
export const formatUsernameToEmail = (usernameOrEmail: string): string => {
  const trimmed = usernameOrEmail.trim().toLowerCase();
  if (!trimmed || trimmed === AGENCY_BRANDING.ADMIN_USERNAME) {
    return AGENCY_BRANDING.ADMIN_EMAIL;
  }
  if (trimmed.includes('@')) return trimmed;
  if (trimmed === 'harikanth' || trimmed === 'sshk5318') return 'sshk5318@gmail.com';
  if (trimmed === 'selvaraj' || trimmed === 'selvarajkm33') return 'selvarajkm33@gmail.com';
  return trimmed;
};
