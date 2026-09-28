import React from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
}

/**
 * ModalPortal renders modal dialogs directly into document.body.
 * This guarantees modals are never trapped or clipped by ancestor
 * CSS transforms, will-change, overflow, or container max-widths.
 */
export const ModalPortal: React.FC<ModalPortalProps> = ({ children }) => {
  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(children, document.body);
};
