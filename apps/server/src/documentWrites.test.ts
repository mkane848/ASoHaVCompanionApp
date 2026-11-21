import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Encounter, Party } from '@asohav/shared';

vi.mock('./repo.js', () => ({ getParty: vi.fn(), saveParty: vi.fn(), listEncountersForCampaign: vi.fn(), saveEncounter: vi.fn() }));

import * as repo from './repo.js';
import { changeEncounter, changeParty } from './documentWrites.js';
import { StaleDocumentError } from './staleDocument.js';

const party = (UpdatedAt: string, Drama: number) => ({ CampaignId: 'cm-1', UpdatedAt, Drama }) as unknown as Party;
const gain = (p: Party) => { p.Drama += 1; return p.Drama; };

beforeEach(() => vi.resetAllMocks());

describe('changeParty', () => {
  it('saves with the UpdatedAt the Party was read at', async () => {
    const out = await changeParty(party('t1', 1), gain);
    expect(repo.saveParty).toHaveBeenCalledWith(expect.objectContaining({ Drama: 2 }), 't1');
    expect(out.result).toBe(2);
  });

  // The state-machine model check's trace: two Drama gains read the same Party; the second save is
  // refused, so it re-reads the first one's result and adds to it instead of overwriting it.
  it('re-reads, reapplies on the newer copy, and saves again after a conflict', async () => {
    vi.mocked(repo.saveParty).mockRejectedValueOnce(new StaleDocumentError()).mockResolvedValueOnce(undefined);
    vi.mocked(repo.getParty).mockResolvedValue(party('t2', 2));

    const out = await changeParty(party('t1', 1), gain);

    expect(repo.getParty).toHaveBeenCalledWith('cm-1');
    expect(repo.saveParty).toHaveBeenLastCalledWith(expect.objectContaining({ Drama: 3 }), 't2');
    expect(out.party.Drama).toBe(3);
  });

  it('gives up with the 409 after a second conflict', async () => {
    vi.mocked(repo.saveParty).mockRejectedValue(new StaleDocumentError());
    vi.mocked(repo.getParty).mockResolvedValue(party('t2', 2));
    await expect(changeParty(party('t1', 1), gain)).rejects.toBeInstanceOf(StaleDocumentError);
    expect(repo.saveParty).toHaveBeenCalledTimes(2);
  });

  it('does not retry an error that is not a conflict', async () => {
    vi.mocked(repo.saveParty).mockRejectedValue(new Error('network'));
    await expect(changeParty(party('t1', 1), gain)).rejects.toThrow('network');
    expect(repo.getParty).not.toHaveBeenCalled();
  });

  it('lets apply refuse the change on the fresh copy', async () => {
    vi.mocked(repo.saveParty).mockRejectedValueOnce(new StaleDocumentError());
    vi.mocked(repo.getParty).mockResolvedValue(party('t2', 0));
    const refuse = (p: Party) => { if (p.Drama === 0) throw new Error('no Drama'); p.Drama -= 1; };
    await expect(changeParty(party('t1', 1), refuse)).rejects.toThrow('no Drama');
    expect(repo.saveParty).toHaveBeenCalledTimes(1);
  });
});

describe('changeEncounter', () => {
  it('re-reads the Encounter by id after a conflict', async () => {
    const read = { Id: 'enc-1', CampaignId: 'cm-1', UpdatedAt: 'e1', History: [] } as unknown as Encounter;
    const fresh = { Id: 'enc-1', CampaignId: 'cm-1', UpdatedAt: 'e2', History: [{ Text: 'newer' }] } as unknown as Encounter;
    vi.mocked(repo.saveEncounter).mockRejectedValueOnce(new StaleDocumentError()).mockResolvedValueOnce(undefined);
    vi.mocked(repo.listEncountersForCampaign).mockResolvedValue([{ Id: 'enc-0' } as Encounter, fresh]);

    const out = await changeEncounter(read, (e) => { e.History = [{ Text: 'mine' } as never, ...e.History]; });

    expect(repo.saveEncounter).toHaveBeenLastCalledWith(expect.objectContaining({ History: [{ Text: 'mine' }, { Text: 'newer' }] }), 'e2');
    expect(out.encounter.UpdatedAt).toBe('e2');
  });
});
