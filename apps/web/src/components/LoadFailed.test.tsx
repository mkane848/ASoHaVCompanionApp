// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { LoadFailed } from './LoadFailed.js';

// Guards 0.77.1: a failed page load used to sit on "Loading…" forever with no way out.
afterEach(cleanup); // Testing Library only auto-cleans when vitest globals are on, and they are not

describe('LoadFailed', () => {
  it('names what failed and retries on request', () => {
    const onRetry = vi.fn();
    render(<LoadFailed what="this campaign" onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('this campaign');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
