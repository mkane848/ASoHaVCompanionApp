import { useLayoutEffect, useRef, useState } from 'react';

/** Shared open/dismiss behavior behind InfoTooltip and GlossaryTermLink's bubbles: tap to toggle,
 *  dismiss on an outside tap or Escape. Deliberately not native `title`/hover — this app is
 *  touch-first, and `title` never shows on a touch device. */
export function useTapReveal<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    if (!open) return;

    // Keep the bubble inside the viewport. It is `position: absolute` under its trigger at every
    // width (a `fixed` card was I-01: a container-type panel becomes the containing block for
    // fixed descendants, so the card landed hundreds of px from its trigger), so only a horizontal
    // nudge is needed: --bubble-dx feeds the bubble's margin-left. Set per instance on the trigger
    // wrapper, since the bubble is always its descendant. Layout effect so there is no flash.
    const el = ref.current;
    function fit() {
      const bubble = el?.querySelector<HTMLElement>('[role="tooltip"]');
      if (!el || !bubble) return;
      el.style.removeProperty('--bubble-dx');
      const r = bubble.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const dx = r.right > vw - 8 ? Math.max(vw - 8 - r.right, 8 - r.left) : r.left < 8 ? 8 - r.left : 0;
      if (dx) el.style.setProperty('--bubble-dx', `${Math.round(dx)}px`);
    }
    fit();
    window.addEventListener('resize', fit);

    function onDocPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // pointerdown, not mousedown: iOS Safari only synthesises mouse events for elements it treats
    // as clickable, so a tap on bare background never reached a mousedown listener (I-08).
    document.addEventListener('pointerdown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', fit);
      document.removeEventListener('pointerdown', onDocPointer);
      document.removeEventListener('keydown', onKey);
      el?.style.removeProperty('--bubble-dx');
    };
  }, [open]);

  return { open, setOpen, ref };
}
