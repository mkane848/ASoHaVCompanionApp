import type { MouseEvent, PointerEvent } from 'react';

// A drag that starts inside a dialog (selecting text in a notes field) and ends over the dimmed
// backdrop dispatches its click to the backdrop, which used to close the dialog and discard the
// draft. Only a press that also began on the backdrop closes it. One pointer is down at a time,
// so a module-level flag is enough and keeps this free of per-modal hook plumbing.
let pressedOnBackdrop = false;

export function backdropClose(onClose: () => void) {
  return {
    onPointerDown: (e: PointerEvent) => {
      pressedOnBackdrop = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent) => {
      const close = pressedOnBackdrop && e.target === e.currentTarget;
      pressedOnBackdrop = false;
      if (close) onClose();
    },
  };
}
