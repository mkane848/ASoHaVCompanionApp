// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { TrackStepper } from './TrackStepper.js';

afterEach(cleanup);

describe('TrackStepper', () => {
  it('exposes the current value in a polite live region', () => {
    const { container, rerender } = render(<TrackStepper label="Potential" value={2} max={5} color="red" onSet={() => {}} />);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Potential: 2 of 5');
    rerender(<TrackStepper label="Potential" value={3} max={5} color="red" onSet={() => {}} />);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Potential: 3 of 5');
  });
});
