// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from './ConfirmModal.js';

// Guards 0.77.1: the destructive button used to take focus on open, so Enter removed the thing.
afterEach(cleanup); // Testing Library only auto-cleans when vitest globals are on, and they are not

describe('ConfirmModal', () => {
  it('opens with Cancel focused, not the destructive action', () => {
    render(<ConfirmModal title="Remove this Clock?" body="It will be removed." confirmLabel="Remove" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('confirms only when asked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal title="t" body="b" confirmLabel="Remove" onConfirm={onConfirm} onCancel={vi.fn()} />);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not cancel on a drag that began inside the dialog and ended on the backdrop', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal title="t" body="b" onConfirm={vi.fn()} onCancel={onCancel} />);
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement as HTMLElement;
    fireEvent.pointerDown(dialog);
    fireEvent.click(backdrop);
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
