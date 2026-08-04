import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCollection, type CollectionDef, type Library, type MeResponse } from '@asohav/shared';
import { api } from '../lib/api.js';
import { useLibrary } from '../lib/useLibrary.js';
import { useAdminUiStore } from '../store/adminUiStore.js';
import { BP, useNarrowerThan } from '../lib/useMediaQuery.js';
import styles from './AdminPanelPage.module.css';
import { AdminNav, ADVANCEMENT_TRACK_VIEWS, type AdminView } from '../features/admin/AdminNav.js';
import { AdminListPane } from '../features/admin/AdminListPane.js';
import { AdminDetailForm } from '../features/admin/AdminDetailForm.js';
import { SettingsView } from '../features/admin/SettingsView.js';
import { KinAdvancementView } from '../features/admin/KinAdvancementView.js';
import { HistoryView } from '../features/admin/HistoryView.js';
import { ValidationView } from '../features/admin/ValidationView.js';
import { DataView } from '../features/admin/DataView.js';

/** 'advancements-potential' / 'advancements-rapport' are nav-only keys — both resolve to the
 *  one real `advancements` collection, filtered by Track. Everything that needs the actual
 *  collection (API calls, the list pane's rows) goes through this rather than getCollection(view)
 *  directly, so those synthetic keys don't leak into a `collection` URL segment the server
 *  doesn't recognize. */
function resolveAdminView(view: AdminView): { col: CollectionDef | null; trackFilter?: 'Potential' | 'Rapport' } {
  const trackFilter = ADVANCEMENT_TRACK_VIEWS[view];
  if (trackFilter) return { col: getCollection('advancements'), trackFilter };
  return { col: getCollection(view) };
}

export default function AdminPanelPage({ me }: { me: MeResponse }) {
  const qc = useQueryClient();
  const { data: library, isLoading } = useLibrary();
  const { view, setView, selectedId, draft, jsonTexts, note, selectObject, createNew, setDraftField, setDraft, setJsonText, setNote } = useAdminUiStore();

  /* Below 1024px the three panes don't fit, so they become a drill-down. `pane`
     is only consulted when narrow; widening the window shows all three again
     without losing your place. */
  const narrow = useNarrowerThan(BP.lg);
  const [pane, setPane] = useState<'nav' | 'list' | 'detail'>('nav');

  const validationQuery = useQuery({ queryKey: ['validation'], queryFn: () => api.library.validation().then((r) => r.issues), enabled: me.user.IsAdmin });
  const changelogQuery = useQuery({ queryKey: ['changelog'], queryFn: () => api.library.changelog().then((r) => r.entries), enabled: me.user.IsAdmin });

  const { col, trackFilter } = resolveAdminView(view);
  const refByQuery = useQuery({
    queryKey: ['referencedBy', col?.key, draft?.Id],
    queryFn: () => api.library.referencedBy(col!.key, draft!.Id).then((r) => r.rows),
    enabled: me.user.IsAdmin && !!col && !!draft?.Id,
  });

  if (!me.user.IsAdmin) return <div className={styles.message}>Content admin access required.</div>;
  if (isLoading || !library) return <div className={styles.message}>Loading…</div>;

  function invalidateLibrary() {
    qc.invalidateQueries({ queryKey: ['library'] });
    qc.invalidateQueries({ queryKey: ['validation'] });
    qc.invalidateQueries({ queryKey: ['changelog'] });
  }

  function selectObj(id: string) {
    if (!col) return;
    const obj = ((library as Library) as any)[col.key].find((x: any) => x.Id === id);
    selectObject(id, obj ?? null);
    setPane('detail');
  }

  /* Collections drill into their list; the tools (settings, history, validation,
     import/export) have no list, so they go straight to their own content. */
  function chooseView(v: typeof view) {
    setView(v);
    setPane(resolveAdminView(v).col ? 'list' : 'detail');
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
    promise.then(({ object }) => {
      setDraft(object);
      invalidateLibrary();
      setNote('Saved.');
    });
  }

  function onDelete() {
    if (!col || !draft) return;
    if (!draft.Id) {
      setDraft(null);
      return;
    }
    api.library.remove(col.key, draft.Id).then(() => {
      setDraft(null);
      invalidateLibrary();
      setNote('Deleted.');
    });
  }

  return (
    <div className={styles.page}>
      <div className="admin-row">
        {(!narrow || pane === 'nav') && (
          <AdminNav
            view={view}
            onSelect={chooseView}
            library={library}
            changeCount={changelogQuery.data?.length ?? 0}
            issueCount={validationQuery.data?.length ?? 0}
          />
        )}

        {col && (!narrow || pane === 'list') && (
          <AdminListPane
            col={col}
            title={trackFilter ?? col.label}
            trackFilter={trackFilter}
            library={library}
            selectedId={selectedId}
            onOpen={selectObj}
            onCreateNew={() => { createNew({ Name: '', ...(trackFilter ? { Track: trackFilter } : {}) }); setPane('detail'); }}
            onBack={narrow ? () => setPane('nav') : undefined}
          />
        )}

        {(!narrow || pane === 'detail') && (
        <div className="admin-pane admin-detail">
          {narrow && (
            <button className={styles.back} onClick={() => setPane(col ? 'list' : 'nav')}>
              &larr; {col ? (trackFilter ?? col.label) : 'Menu'}
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
              onDelete={onDelete}
            />
          )}

          {view === 'settings' && (
            <SettingsView
              settings={library.settings}
              onSave={(values) => api.library.updateSettings(values).then(() => { invalidateLibrary(); setNote('Settings saved.'); })}
            />
          )}

          {view === 'advancements-kin' && <KinAdvancementView settings={library.settings} />}
          {view === 'history' && <HistoryView entries={changelogQuery.data ?? []} />}
          {view === 'validation' && <ValidationView issues={validationQuery.data ?? []} />}
          {view === 'data' && (
            <DataView
              library={library}
              onExport={() => {
                api.library.export().then((body) => {
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }));
                  a.download = 'asohav-library.json';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                });
              }}
              onImport={(file) => {
                file
                  .text()
                  .then((txt) => api.library.import(JSON.parse(txt)))
                  .then(() => { invalidateLibrary(); setNote('Library imported.'); })
                  .catch((err) => setNote(`Import failed — ${err.message}`));
              }}
              onReset={() => api.library.reset().then(() => { invalidateLibrary(); setNote('Library reset to seed.'); })}
            />
          )}

          <div className={styles.note}>{note}</div>
        </div>
        )}
      </div>
    </div>
  );
}

