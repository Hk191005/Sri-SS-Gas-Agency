import React from 'react';
import { AGENCY_BRANDING } from '../../lib/constants';

interface AgencyLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  lightBackground?: boolean;
}

export const AgencyLogo: React.FC<AgencyLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  lightBackground = false,
}) => {
  // Height sizing mapping
  const heightClasses = {
    sm: variant === 'full' ? 'h-10' : 'h-8',
    md: variant === 'full' ? 'h-14' : 'h-10',
    lg: variant === 'full' ? 'h-24' : 'h-16',
    xl: variant === 'full' ? 'h-36' : 'h-24',
  };

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <img
        src={AGENCY_BRANDING.LOGO_PATH}
        alt="SUPERGAS® - SRI SS GAS AGENCY"
        className={`${heightClasses[size]} w-auto object-contain transition-transform duration-200 ${
          lightBackground ? '' : 'rounded-lg bg-white p-1.5 shadow-xs'
        }`}
      />
    </div>
  );
};
