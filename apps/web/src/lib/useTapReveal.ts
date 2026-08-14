import { useEffect, useRef, useState } from 'react';

/** Shared open/dismiss behavior behind InfoTooltip and GlossaryTermLink's bubbles: tap to toggle,
 *  dismiss on an outside click or Escape. Deliberately not native `title`/hover — this app is
 *  touch-first, and `title` never shows on a touch device. */
export function useTapReveal<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;

    // Powers the mobile fixed-card bubble (InfoTooltip.module.css / GlossaryText.module.css's
    // .bubble, below 600px — WorkPlan-0.25.0.md section F): an absolutely-positioned bubble
    // anchored to its trigger's own left edge can hang off the right side of the screen. Below
    // 600px the bubble switches to `position: fixed` and spans the content width instead, which
    // means it no longer inherits a vertical position from normal layout flow — --bubble-top,
    // read here from the trigger's own measured rect, supplies one. Set on `ref.current` (the
    // trigger wrapper) rather than a global custom property, since it's per-instance and the
    // bubble is always a CSS descendant of this element.
    const el = ref.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--bubble-top', `${Math.round(rect.bottom + 6)}px`);
    }

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
