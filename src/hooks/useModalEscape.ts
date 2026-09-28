import { useEffect } from 'react';

/**
 * Authoritative Escape key hook for modals and dialogs.
 * Uses window keydown in the capture phase (true) so Escape works
 * reliably even when an input, select, textarea, or nested control has focus.
 */
export function useModalEscape(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);
}
