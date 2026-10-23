// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, act } from '@testing-library/react';
import { Toast } from './Toast.js';

// Guards 0.77.2: callers pass an inline arrow, so every parent re-render handed Toast a new
// onDismiss and restarted its timer, which kept a toast on screen while the user typed.
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Toast', () => {
  it('dismisses six seconds after it appeared, however often its parent re-renders', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast message="Saved" onDismiss={() => onDismiss()} />);
    for (let i = 0; i < 5; i++) {
      act(() => { vi.advanceTimersByTime(1000); });
      rerender(<Toast message="Saved" onDismiss={() => onDismiss()} />); // a fresh arrow each time
    }
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls the latest onDismiss, not the first', () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(<Toast message="Saved" onDismiss={first} />);
    rerender(<Toast message="Saved" onDismiss={latest} />);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });
});
