// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { Library } from '@asohav/shared';
import { AddCampAssetModal } from './AddCampAssetModal.js';

afterEach(cleanup);
const library = { campAssets: [] } as unknown as Library;

describe('AddCampAssetModal Tier field', () => {
  it('lets the player clear the field to retype, then clamps on blur and on Add', () => {
    const onAdd = vi.fn();
    render(<AddCampAssetModal library={library} onAdd={onAdd} onClose={vi.fn()} />);
    const tier = screen.getByLabelText('Tier') as HTMLInputElement;
    fireEvent.change(tier, { target: { value: '3' } });
    fireEvent.change(tier, { target: { value: '' } });
    expect(tier.value).toBe(''); // used to snap straight back to 1 mid-edit
    fireEvent.change(screen.getByLabelText('Camp Asset name'), { target: { value: 'Forge' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd.mock.calls[0][0].Tier).toBe(1);
    fireEvent.blur(tier);
    expect(tier.value).toBe('1');
    fireEvent.change(tier, { target: { value: '4' } });
    fireEvent.blur(tier);
    expect(tier.value).toBe('4');
  });
});
