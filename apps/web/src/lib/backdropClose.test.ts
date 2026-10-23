import { describe, expect, it, vi } from 'vitest';
import { backdropClose } from './backdropClose.js';

// Plain objects stand in for React's synthetic events: the helper only reads target and currentTarget.
const backdrop = {};
const inside = {};
const down = (target: object) => ({ target, currentTarget: backdrop }) as never;

describe('backdropClose', () => {
  it('closes on a press and release that both land on the backdrop', () => {
    const onClose = vi.fn();
    const h = backdropClose(onClose);
    h.onPointerDown(down(backdrop));
    h.onClick(down(backdrop));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the press began inside the dialog and was released on the backdrop', () => {
    const onClose = vi.fn();
    const h = backdropClose(onClose);
    h.onPointerDown(down(inside));
    h.onClick(down(backdrop));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('forgets the press after one click, so a stray click cannot close the next dialog', () => {
    const onClose = vi.fn();
    const h = backdropClose(onClose);
    h.onPointerDown(down(backdrop));
    h.onClick(down(backdrop));
    h.onClick(down(backdrop));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
