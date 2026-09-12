import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCollection, type Library, type MeResponse } from '@asohav/shared';
import { api } from '../lib/api.js';
import { useLibrary } from '../lib/useLibrary.js';
import { useAdminUiStore, isDraftDirty } from '../store/adminUiStore.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { BP, useNarrowerThan } from '../lib/useMediaQuery.js';
import styles from './AdminPanelPage.module.css';
import { AdminNav, ADMIN_TOOL_VIEWS } from '../features/admin/AdminNav.js';
import { AdminListPane } from '../features/admin/AdminListPane.js';
import { rowsOf } from '../features/admin/adminHelpers.js';
import { AdminDetailForm } from '../features/admin/AdminDetailForm.js';
import { SettingsView } from '../features/admin/SettingsView.js';
import { BondAdvancementView } from '../features/admin/BondAdvancementView.js';
import { HistoryView } from '../features/admin/HistoryView.js';
import { ValidationView } from '../features/admin/ValidationView.js';
import { DataView } from '../features/admin/DataView.js';
import { UsersView } from '../features/admin/UsersView.js';
import { CampaignsAdminView } from '../features/admin/CampaignsAdminView.js';
import { CharactersAdminView } from '../features/admin/CharactersAdminView.js';

/** Whether a `/admin/:view` segment names something this panel can actually show — every library
 *  collection, plus the tool views the nav declares. A typo falls through to the default view
 *  rather than rendering an empty pane. */
function isAdminView(v: string): boolean {
  return Boolean(getCollection(v)) || ADMIN_TOOL_VIEWS.includes(v);
}

export default function AdminPanelPage({ me }: { me: MeResponse }) {
  const qc = useQueryClient();
  const { data: library, isLoading } = useLibrary();
  const { view, setView, selectedId, draft, pristine, jsonTexts, note, selectObject, createNew, duplicateDraft, setDraftField, setDraft, setJsonText, setNote } = useAdminUiStore();
  /* Where to go once the admin confirms abandoning unsaved edits. Held rather than executed so
     the confirm can be a plain yes/no over one deferred action, whatever kind of navigation it
     was — another record, another collection, or the New button. */
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  const { view: viewParam, id: idParam } = useParams<{ view?: string; id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const adoptedUrl = useRef(false);

  /* Below 1024px the three panes don't fit, so they become a drill-down. `pane`
     is only consulted when narrow; widening the window shows all three again
     without losing your place. A deep link names which pane it means, so it is read once here
     rather than set from the adoption effect below — the pane a URL implies is knowable from the
     URL alone, with no need for the library to have loaded. */
  const narrow = useNarrowerThan(BP.lg);
  const [pane, setPane] = useState<'nav' | 'list' | 'detail'>(() => {
    if (!viewParam || !isAdminView(viewParam)) return 'nav';
    if (!getCollection(viewParam)) return 'detail';
    return idParam ? 'detail' : 'list';
  });

  /* Both halves of making a record a real address, in one effect so they can't race each other.
     `view` lived only in Zustand until 0.51.0, so a refresh — or a link to a record — always
     landed you back on Virtues with nothing selected.

     First run after the library arrives, the URL leads: a `/admin/moves/m-1` deep link opens that
     record. From then on the store leads and this mirrors it back, with `replace` rather than
     `push` — every record you clicked would otherwise become a history entry, and stepping back
     through them would bypass the unsaved-changes confirm that guards every other way out of a
     draft. The id in the URL comes from `draft`, not `selectedId`, so it names the record actually
     open: it clears itself on delete and on New, and fills in on its own once a new record is
     saved and the server hands back an Id. */
  useEffect(() => {
    if (!library) return;

    if (!adoptedUrl.current) {
      adoptedUrl.current = true;
      if (viewParam && isAdminView(viewParam)) {
        setView(viewParam);
        const target = getCollection(viewParam);
        const obj = target && idParam ? rowsOf(library, target.key).find((x) => x.Id === idParam) ?? null : null;
        if (obj && idParam) selectObject(idParam, obj);
        // The state just set mirrors itself on this effect's next run, once it has landed.
        return;
      }
    }

    const want = `/admin/${view}${draft?.Id ? `/${draft.Id}` : ''}`;
    if (location.pathname !== want) navigate(want, { replace: true });
  }, [library, viewParam, idParam, view, draft?.Id, location.pathname, navigate, setView, selectObject]);

  const validationQuery = useQuery({ queryKey: ['validation'], queryFn: () => api.library.validation().then((r) => r.issues), enabled: me.user.IsAdmin });
  const changelogQuery = useQuery({ queryKey: ['changelog'], queryFn: () => api.library.changelog().then((r) => r.entries), enabled: me.user.IsAdmin });
  const usersQuery = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.admin.users().then((r) => r.users), enabled: me.user.IsAdmin });
  const adminCampaignsQuery = useQuery({ queryKey: ['admin', 'campaigns'], queryFn: () => api.admin.campaigns().then((r) => r.campaigns), enabled: me.user.IsAdmin });
  const adminCharactersQuery = useQuery({ queryKey: ['admin', 'characters'], queryFn: () => api.admin.characters().then((r) => r.characters), enabled: me.user.IsAdmin });

  const col = getCollection(view);
  const refByQuery = useQuery({
    queryKey: ['referencedBy', col?.key, draft?.Id],
    queryFn: () => api.library.referencedBy(col!.key, draft!.Id).then((r) => r.rows),
    enabled: me.user.IsAdmin && !!col && !!draft?.Id,
  });

  if (!me.user.IsAdmin) return <div className={styles.message}>Content admin access required.</div>;
  if (isLoading || !library) return <div className={styles.message}>Loading…</div>;

  /* Every library mutation that doesn't need its own result goes through here. Before 0.51.0
     these were bare `.then()` chains, so a failed settings save or reset surfaced only as an
     unhandled console rejection — the admin saw nothing at all. The refetch on failure matters as
     much as the message: a write rejected by the optimistic-locking precondition (0.50.0) means
     someone else's version is the live one, and the next attempt should build on it. */
  function runMutation(promise: Promise<unknown>, okNote: string, failPrefix: string) {
    promise
      .then(() => { invalidateLibrary(); setNote(okNote); })
      .catch((err: Error) => { invalidateLibrary(); setNote(`${failPrefix} — ${err.message}`); });
  }

  function invalidateLibrary() {
    qc.invalidateQueries({ queryKey: ['library'] });
    qc.invalidateQueries({ queryKey: ['validation'] });
    qc.invalidateQueries({ queryKey: ['changelog'] });
  }

  const dirty = isDraftDirty({ draft, pristine, jsonTexts });

  /* Object Ids in most-recently-changed order, for the list pane's "Recently changed" sort. The
     changelog is already fetched for the History view, so this costs no extra request. */
  const recentIds = (changelogQuery.data ?? []).map((e) => e.ObjectId);

  /** Runs `go`, or parks it behind a confirm if there are unsaved edits to lose. */
  function guardNav(go: () => void) {
    if (dirty) setPendingNav(() => go);
    else go();
  }

  function selectObj(id: string) {
    if (!col) return;
    guardNav(() => {
      const obj = rowsOf(library as Library, col.key).find((x) => x.Id === id) ?? null;
      selectObject(id, obj ?? null);
      setPane('detail');
    });
  }

  /* Collections drill into their list; the tools (settings, history, validation,
     import/export) have no list, so they go straight to their own content. */
  function chooseView(v: typeof view) {
    guardNav(() => {
      setNote('');
      setView(v);
      setPane(getCollection(v) ? 'list' : 'detail');
    });
  }

  /* Opens one specific record from outside the list pane — today, a Validation issue. Goes
     through `setView` first because that is what clears the previously open draft; selecting into
     a stale one would show the new record's fields over the old record's leftovers. */
  function goToRecord(collection: string, id: string) {
    const target = getCollection(collection);
    if (!target) return;
    guardNav(() => {
      setNote('');
      setView(target.key);
      const obj = rowsOf(library as Library, target.key).find((x) => x.Id === id) ?? null;
      selectObject(id, obj);
      setPane('detail');
    });
  }

  function onSave() {
    if (!col || !draft) return;
    const values: Record<string, any> = {};
    try {
      for (const f of col.fields) {
        if (f.type === 'json') {
          const pending = jsonTexts[f.name];
          if (pending !== undefined) {
            const txt = pending.trim();
            values[f.name] = txt ? JSON.parse(txt) : null;
          } else {
            values[f.name] = draft[f.name];
          }
        } else {
          values[f.name] = draft[f.name];
        }
      }
    } catch (err: any) {
      setNote(`Not saved — ${err.message}`);
      return;
    }

    const promise = draft.Id ? api.library.update(col.key, draft.Id, values) : api.library.create(col.key, values);
    promise
      .then(({ object }) => {
        setDraft(object);
        invalidateLibrary();
        setNote('Saved.');
      })
      // A library write is a read-modify-write of the whole blob, so the server rejects one
      // whose `updated_at` precondition no longer holds (0.50.0). Refetch so the next attempt
      // builds on what actually landed rather than silently clobbering it. Without this catch
      // a failed save was invisible — an unhandled console rejection and nothing else.
      .catch((err: Error) => {
        invalidateLibrary();
        setNote(`Not saved — ${err.message}`);
      });
  }

  function onDelete() {
    if (!col || !draft) return;
    if (!draft.Id) {
      setDraft(null);
      return;
    }
    // The delete only reaches here through AdminDetailForm's confirm, which names how many
    // references break — so this click is the informed consent the server's `force` flag is
    // asking for. A stale/loading ref count just means the server refuses and says why.
    api.library
      .remove(col.key, draft.Id, (refByQuery.data ?? []).length > 0)
      .then(() => {
        setDraft(null);
        invalidateLibrary();
        setNote('Deleted.');
      })
      .catch((err: Error) => {
        invalidateLibrary();
        setNote(`Not deleted — ${err.message}`);
      });
  }

  /* Guarded like any other navigation: you're leaving the original behind either way, and the
     copy is taken from the record as saved, so "discard and leave" means here exactly what it
     means everywhere else. Nothing is written until Save — the copy has no Id, so that Save is a
     `create`, and the server mints the new Id. */
  function onDuplicate() {
    guardNav(() => {
      duplicateDraft();
      setNote('Duplicated — not saved yet.');
    });
  }

  function onRestore(entryId: string, name: string) {
    runMutation(api.library.restore(entryId), `Restored “${name}”.`, 'Not restored');
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Content Admin</h1>
      <div className="admin-row">
        {(!narrow || pane === 'nav') && (
          <AdminNav
            view={view}
            onSelect={chooseView}
            library={library}
            changeCount={changelogQuery.data?.length ?? 0}
            issueCount={validationQuery.data?.length ?? 0}
            userCount={usersQuery.data?.length}
            campaignCount={adminCampaignsQuery.data?.length}
            characterCount={adminCharactersQuery.data?.length}
          />
        )}

        {col && (!narrow || pane === 'list') && (
          <AdminListPane
            col={col}
            library={library}
            selectedId={selectedId}
            recentIds={recentIds}
            onOpen={selectObj}
            onCreateNew={() => guardNav(() => { createNew({ Name: '' }); setPane('detail'); })}
            onBack={narrow ? () => setPane('nav') : undefined}
          />
        )}

        {(!narrow || pane === 'detail') && (
        <div className="admin-pane admin-detail">
          {narrow && (
            <button className={styles.back} onClick={() => setPane(col ? 'list' : 'nav')}>
              &larr; {col ? col.label : 'Menu'}
            </button>
          )}
          {col && (
            <AdminDetailForm
              col={col}
              draft={draft}
              library={library}
              referencedBy={refByQuery.data ?? []}
              jsonTexts={jsonTexts}
              onChangeField={setDraftField}
              onChangeJsonText={setJsonText}
              onSave={onSave}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          )}

          {view === 'settings' && (
            <SettingsView
              settings={library.settings}
              onSave={(values) => runMutation(api.library.updateSettings(values), 'Settings saved.', 'Settings not saved')}
            />
          )}

          {view === 'improvements-bond' && <BondAdvancementView settings={library.settings} />}
          {view === 'history' && (
            <HistoryView
              entries={changelogQuery.data ?? []}
              library={library}
              onRestore={(e) => onRestore(e.Id, e.ObjectName)}
            />
          )}
          {view === 'validation' && (
            <ValidationView issues={validationQuery.data ?? []} onOpen={(v) => goToRecord(v.collection, v.objectId)} />
          )}
          {view === 'data' && (
            <DataView
              library={library}
              onExport={() => {
                api.library
                  .export()
                  .then((body) => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }));
                    a.download = 'asohav-library.json';
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                  })
                  .catch((err: Error) => setNote(`Export failed — ${err.message}`));
              }}
              onImport={(file) => {
                file
                  .text()
                  .then((txt) => api.library.import(JSON.parse(txt)))
                  .then(() => { invalidateLibrary(); setNote('Library imported.'); })
                  .catch((err) => setNote(`Import failed — ${err.message}`));
              }}
              onReset={() => runMutation(api.library.reset(), 'Library reset to seed.', 'Reset failed')}
            />
          )}

          {view === 'admin-users' && (
            <UsersView
              users={usersQuery.data ?? []}
              onResetPassword={(id) => api.admin.resetPassword(id).then((r) => r.actionLink)}
            />
          )}
          {view === 'admin-campaigns' && (
            <CampaignsAdminView
              campaigns={adminCampaignsQuery.data ?? []}
              onDelete={(id) =>
                api.admin.deleteCampaign(id).then(() => {
                  qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
                  qc.invalidateQueries({ queryKey: ['admin', 'characters'] });
                  qc.invalidateQueries({ queryKey: ['me'] });
                })
              }
            />
          )}
          {view === 'admin-characters' && (
            <CharactersAdminView
              characters={adminCharactersQuery.data ?? []}
              onDelete={(campaignId, characterId) =>
                api.admin.deleteCharacter(campaignId, characterId).then(() => {
                  qc.invalidateQueries({ queryKey: ['admin', 'characters'] });
                  qc.invalidateQueries({ queryKey: ['bootstrap', campaignId] });
                })
              }
            />
          )}

          <div className={styles.note}>{note}</div>
        </div>
        )}
      </div>

      {pendingNav && (
        <ConfirmModal
          title="Discard unsaved changes?"
          body={`"${draft?.Name || draft?.Id || 'This record'}" has edits you haven't saved. Leaving now loses them.`}
          confirmLabel="Discard and leave"
          cancelLabel="Keep editing"
          onConfirm={() => { const go = pendingNav; setPendingNav(null); go(); }}
          onCancel={() => setPendingNav(null)}
        />
      )}
    </div>
  );
}
