import { useEffect } from 'react';

/**
 * Locks body scroll while a modal is open: touch drags then scroll the
 * dialog, not the page beneath it. Restores the previous value on close.
 */
export function useScrollLock() {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
}
