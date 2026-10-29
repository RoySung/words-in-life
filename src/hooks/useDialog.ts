import { useEffect, useRef } from 'react';

/** Native dialog supplies focus containment, Escape and focus restoration. */
export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const cancel = (event: Event) => { event.preventDefault(); closeRef.current(); };
    dialog?.addEventListener('cancel', cancel);
    return () => { dialog?.removeEventListener('cancel', cancel); dialog?.close(); previous?.focus(); };
  }, []);
  return ref;
}
