import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { CharacterSheet } from '@asohav/shared';

vi.mock('./repo.js', () => ({ getSheet: vi.fn(), saveSheet: vi.fn() }));

import * as repo from './repo.js';
import { changeSheet } from './sheetWrites.js';
import { StaleDocumentError } from './staleDocument.js';

const sheet = (UpdatedAt: string, Strain = [true, true]) => ({ CharacterId: 'ch-1', UpdatedAt, Strain }) as unknown as CharacterSheet;
const clear = (s: CharacterSheet) => { s.Strain = s.Strain.map(() => false); return 'done'; };

beforeEach(() => vi.resetAllMocks());

describe('changeSheet', () => {
  it('saves with the UpdatedAt the sheet was read at', async () => {
    const out = await changeSheet(sheet('t1'), 'cm-1', clear);
    expect(repo.saveSheet).toHaveBeenCalledWith(expect.objectContaining({ Strain: [false, false] }), 'cm-1', 't1');
    expect(out.result).toBe('done');
  });

  it("re-reads, reapplies on the owner's newer copy, and saves again after a conflict", async () => {
    vi.mocked(repo.saveSheet).mockRejectedValueOnce(new StaleDocumentError()).mockResolvedValueOnce(undefined);
    vi.mocked(repo.getSheet).mockResolvedValue(sheet('t2', [true, true, true]));

    const out = await changeSheet(sheet('t1'), 'cm-1', clear);

    expect(repo.saveSheet).toHaveBeenLastCalledWith(expect.objectContaining({ Strain: [false, false, false] }), 'cm-1', 't2');
    expect(out.sheet.Strain).toEqual([false, false, false]);
  });

  it('gives up with the 409 after a second conflict', async () => {
    vi.mocked(repo.saveSheet).mockRejectedValue(new StaleDocumentError());
    vi.mocked(repo.getSheet).mockResolvedValue(sheet('t2'));
    await expect(changeSheet(sheet('t1'), 'cm-1', clear)).rejects.toBeInstanceOf(StaleDocumentError);
    expect(repo.saveSheet).toHaveBeenCalledTimes(2);
  });

  it('does not retry an error that is not a conflict', async () => {
    vi.mocked(repo.saveSheet).mockRejectedValue(new Error('network'));
    await expect(changeSheet(sheet('t1'), 'cm-1', clear)).rejects.toThrow('network');
    expect(repo.getSheet).not.toHaveBeenCalled();
  });
});
