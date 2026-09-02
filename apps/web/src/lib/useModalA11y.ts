import { useCallback, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// EndSessionModal nests MarkBondModal (Mark Bond, spent from Hold, opens on top of an already-open
// End the Session dialog) — the only place two of this app's modals are ever open at once. Every
// open dialog's keydown listener lives on `document`, so a bare Escape handler would fire for
// both and close the whole stack in one press. Tracking which `onClose` is topmost and only
// acting on that one keeps Escape closing just the dialog actually in front, however deep a
// future nesting case goes.
const openStack: (() => void)[] = [];

/** Shared modal-dialog behavior: every one of this app's modals hand-rolled its own backdrop +
 *  dialog div with no focus management at all — a keyboard user could Tab straight through into
 *  the page behind it, and Escape did nothing. Attach the returned ref to the `modal.dialog`
 *  element (alongside `role="dialog"` `aria-modal="true"` `aria-labelledby={titleId}` `tabIndex={-1}`,
 *  which stay in each consumer's own JSX since they don't vary at runtime the way this hook's
 *  behavior needs to). On attach: moves focus into the dialog (the first focusable element, or the
 *  dialog itself if it has none) and remembers what was focused before. While attached: Tab/Shift+Tab
 *  cycle within the dialog instead of escaping it, and Escape calls `onClose` — but only for the
 *  topmost dialog if more than one is open. On detach: focus returns to whatever was focused
 *  before the dialog opened.
 *
 *  A callback ref, not `useRef` + `useEffect`, on purpose — most consumers unmount the whole
 *  component when closed (`{giving && <GiveStatusModal ... />}`), but a couple (ForgeBondPicker,
 *  which the caller renders unconditionally and that internally `return null`s when there's no
 *  active picker) never unmount at all; only the dialog's own subtree appears and disappears.
 *  React calls a callback ref with the node on attach and with `null` on detach in both cases,
 *  which a one-time mount effect wouldn't catch for the second case. */
export function useModalA11y<T extends HTMLElement>(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const cleanupRef = useRef<(() => void) | null>(null);

  return useCallback((dialog: T | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable[0] ?? dialog).focus();

    const closeThis = () => onCloseRef.current();
    openStack.push(closeThis);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (openStack[openStack.length - 1] === closeThis) {
          e.stopPropagation();
          closeThis();
        }
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    cleanupRef.current = () => {
      document.removeEventListener('keydown', onKeyDown);
      const idx = openStack.indexOf(closeThis);
      if (idx !== -1) openStack.splice(idx, 1);
      previouslyFocused?.focus();
    };
  }, []);
}
