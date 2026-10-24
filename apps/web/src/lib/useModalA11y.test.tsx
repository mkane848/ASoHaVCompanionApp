// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useModalA11y } from './useModalA11y.js';

function Dialog({ autofocusSecond = false }: { autofocusSecond?: boolean }) {
  const ref = useModalA11y<HTMLDivElement>(() => {});
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Test" tabIndex={-1}>
      <input aria-label="Notes" />
      <button data-autofocus={autofocusSecond ? '' : undefined}>Cancel</button>
      <button>Save</button>
    </div>
  );
}

function setPointer(coarse: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: coarse && /coarse/.test(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  // @ts-expect-error restore jsdom's lack of matchMedia
  delete window.matchMedia;
});

// iPad review I-22: focusing the first control of a dialog raises the on-screen keyboard when it
// is a text field. On a touch device the dialog itself takes focus unless a control opts in.
describe('useModalA11y initial focus', () => {
  it('focuses the first control with a fine pointer (unchanged)', () => {
    setPointer(false);
    render(<Dialog />);
    expect(document.activeElement).toBe(screen.getByLabelText('Notes'));
  });

  it('focuses the dialog, not its text field, on a touch device', () => {
    setPointer(true);
    render(<Dialog />);
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('still honours data-autofocus on a touch device', () => {
    setPointer(true);
    render(<Dialog autofocusSecond />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('keeps the trap closed: Shift+Tab from the dialog container wraps to the last control', () => {
    setPointer(true);
    render(<Dialog />);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save' }));
  });

  it('gives focus back to the opener on close', () => {
    setPointer(false);
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<Dialog />);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
