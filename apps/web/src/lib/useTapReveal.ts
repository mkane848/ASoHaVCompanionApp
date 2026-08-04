import { useEffect, useRef, useState } from 'react';

/** Shared open/dismiss behavior behind InfoTooltip and GlossaryTermLink's bubbles: tap to toggle,
 *  dismiss on an outside click or Escape. Deliberately not native `title`/hover — this app is
 *  touch-first, and `title` never shows on a touch device. */
export function useTapReveal<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}
