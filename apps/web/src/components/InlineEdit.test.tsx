// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InlineEdit } from './InlineEdit.js';

afterEach(cleanup);

// iPad review I-12: the × removed on pointerdown, so a touch that began on it and turned into a
// scroll had already deleted the item. It now removes on click, which a scroll never produces.
describe('InlineEdit remove (×)', () => {
  function open(onRemove: () => void) {
    render(<InlineEdit value="Scar" placeholder="Look" ariaLabel="Look" onCommit={() => {}} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /Look: Scar/ }));
    return screen.getByRole('button', { name: 'Remove Look' });
  }

  it('does not remove on pointerdown (a touch that becomes a scroll never clicks)', () => {
    const onRemove = vi.fn();
    const x = open(onRemove);
    fireEvent.pointerDown(x, { pointerType: 'touch' });
    fireEvent.pointerCancel(x, { pointerType: 'touch' });
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('still keeps focus on the field during a press, so blur does not swallow the remove', () => {
    const x = open(() => {});
    expect(fireEvent.pointerDown(x)).toBe(false); // false = preventDefault was called
    expect(fireEvent.mouseDown(x)).toBe(false);
  });

  it('removes exactly once on click (mouse, touch tap and keyboard all end in a click)', () => {
    const onRemove = vi.fn();
    const x = open(onRemove);
    fireEvent.pointerDown(x);
    fireEvent.pointerUp(x);
    fireEvent.click(x);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
