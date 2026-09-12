import { describe, expect, it, beforeEach } from 'vitest';
import { useAdminUiStore, isDraftDirty } from './adminUiStore.js';

/* Dirty tracking landed in 0.51.0. Before it, selectObject/setView overwrote `draft`
   unconditionally, so switching record or collection silently discarded unsaved edits. */
describe('isDraftDirty', () => {
  const record = { Id: 'v-might', Name: 'Might', Tagline: 'Physicality & Force' };

  it('is clean with nothing open', () => {
    expect(isDraftDirty({ draft: null, pristine: null, jsonTexts: {} })).toBe(false);
  });

  it('is clean immediately after loading a record', () => {
    expect(isDraftDirty({ draft: { ...record }, pristine: { ...record }, jsonTexts: {} })).toBe(false);
  });

  it('is dirty once a field differs', () => {
    expect(isDraftDirty({ draft: { ...record, Name: 'Mightier' }, pristine: { ...record }, jsonTexts: {} })).toBe(true);
  });

  it('is clean again when a field is typed back to its original value', () => {
    // Compared by serialisation, not reference — setDraftField rebuilds the object on every
    // keystroke, so a reference check would call every draft dirty forever.
    expect(isDraftDirty({ draft: { ...record }, pristine: { ...record }, jsonTexts: {} })).toBe(false);
  });

  it('is dirty on a pending JSON text edit, which never reaches draft until save', () => {
    expect(isDraftDirty({ draft: { ...record }, pristine: { ...record }, jsonTexts: { HoldGrant: '{ "10+": ' } })).toBe(true);
  });
});

describe('adminUiStore draft lifecycle', () => {
  beforeEach(() => {
    useAdminUiStore.setState({ view: 'virtues', selectedId: null, draft: null, pristine: null, jsonTexts: {}, note: '' });
  });

  it('selectObject snapshots pristine separately from draft', () => {
    const obj = { Id: 'v-might', Name: 'Might' };
    useAdminUiStore.getState().selectObject('v-might', obj);
    useAdminUiStore.getState().setDraftField('Name', 'Changed');

    const s = useAdminUiStore.getState();
    expect(s.draft?.Name).toBe('Changed');
    expect(s.pristine?.Name).toBe('Might');
    expect(isDraftDirty(s)).toBe(true);
  });

  it('a new record is clean until typed into', () => {
    useAdminUiStore.getState().createNew({ Name: '' });
    expect(isDraftDirty(useAdminUiStore.getState())).toBe(false);

    useAdminUiStore.getState().setDraftField('Name', 'R');
    expect(isDraftDirty(useAdminUiStore.getState())).toBe(true);
  });

  it('duplicateDraft drops the Id, names the copy, and reads as dirty straight away', () => {
    useAdminUiStore.getState().selectObject('v-might', { Id: 'v-might', Name: 'Might', Tagline: 'Physicality & Force' });
    useAdminUiStore.getState().duplicateDraft();

    const s = useAdminUiStore.getState();
    expect(s.draft?.Id).toBeUndefined();
    expect(s.draft?.Name).toBe('Might (copy)');
    expect(s.draft?.Tagline).toBe('Physicality & Force');
    expect(s.selectedId).toBeNull();
    // Unlike an empty New record, a pre-filled copy has real content to lose, so abandoning it
    // has to warn — which means pristine stays null rather than cloning the copy.
    expect(isDraftDirty(s)).toBe(true);
  });

  it('duplicateDraft copies the record as saved, not as edited', () => {
    useAdminUiStore.getState().selectObject('v-might', { Id: 'v-might', Name: 'Might' });
    useAdminUiStore.getState().setDraftField('Name', 'Half-typed edit');
    useAdminUiStore.getState().duplicateDraft();

    // The caller puts this behind the same discard-changes confirm as any other navigation, so
    // the copy taking the edits would contradict what that confirm just said.
    expect(useAdminUiStore.getState().draft?.Name).toBe('Might (copy)');
  });

  it('duplicateDraft leaves an empty store alone', () => {
    useAdminUiStore.getState().duplicateDraft();
    expect(useAdminUiStore.getState().draft).toBeNull();
  });

  it('setDraft marks clean again — it carries the server response after a save', () => {
    useAdminUiStore.getState().createNew({ Name: '' });
    useAdminUiStore.getState().setDraftField('Name', 'Resolve');
    expect(isDraftDirty(useAdminUiStore.getState())).toBe(true);

    useAdminUiStore.getState().setDraft({ Id: 'v-new', Name: 'Resolve' });
    expect(isDraftDirty(useAdminUiStore.getState())).toBe(false);
  });
});
