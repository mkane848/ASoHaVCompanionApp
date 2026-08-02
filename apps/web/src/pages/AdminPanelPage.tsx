import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCollection, type Library, type MeResponse } from '@asohav/shared';
import { api } from '../lib/api.js';
import { useLibrary } from '../lib/useLibrary.js';
import { useAdminUiStore } from '../store/adminUiStore.js';
import { AdminNav } from '../features/admin/AdminNav.js';
import { AdminListPane } from '../features/admin/AdminListPane.js';
import { AdminDetailForm } from '../features/admin/AdminDetailForm.js';
import { SettingsView } from '../features/admin/SettingsView.js';
import { HistoryView } from '../features/admin/HistoryView.js';
import { ValidationView } from '../features/admin/ValidationView.js';
import { DataView } from '../features/admin/DataView.js';

export default function AdminPanelPage({ me }: { me: MeResponse }) {
  const qc = useQueryClient();
  const { data: library, isLoading } = useLibrary();
  const { view, setView, selectedId, draft, jsonTexts, note, selectObject, createNew, setDraftField, setDraft, setJsonText, setNote } = useAdminUiStore();

  const validationQuery = useQuery({ queryKey: ['validation'], queryFn: () => api.library.validation().then((r) => r.issues), enabled: me.user.IsAdmin });
  const changelogQuery = useQuery({ queryKey: ['changelog'], queryFn: () => api.library.changelog().then((r) => r.entries), enabled: me.user.IsAdmin });

  const col = getCollection(view);
  const refByQuery = useQuery({
    queryKey: ['referencedBy', view, draft?.Id],
    queryFn: () => api.library.referencedBy(view, draft!.Id).then((r) => r.rows),
    enabled: me.user.IsAdmin && !!col && !!draft?.Id,
  });

  if (!me.user.IsAdmin) return <div style={{ padding: 20 }}>Content admin access required.</div>;
  if (isLoading || !library) return <div style={{ padding: 20 }}>Loading…</div>;

  function invalidateLibrary() {
    qc.invalidateQueries({ queryKey: ['library'] });
    qc.invalidateQueries({ queryKey: ['validation'] });
    qc.invalidateQueries({ queryKey: ['changelog'] });
  }

  function selectObj(id: string) {
    if (!col) return;
    const obj = ((library as Library) as any)[col.key].find((x: any) => x.Id === id);
    selectObject(id, obj ?? null);
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
    <div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto' }}>
        <AdminNav
          view={view}
          onSelect={setView}
          library={library}
          changeCount={changelogQuery.data?.length ?? 0}
          issueCount={validationQuery.data?.length ?? 0}
        />

        {col && (
          <AdminListPane
            col={col}
            library={library}
            selectedId={selectedId}
            onOpen={selectObj}
            onCreateNew={() => createNew({ Name: '' })}
          />
        )}

        <div style={{ flex: '1 1 420px', padding: '18px 22px', minHeight: 'calc(100dvh - var(--app-bar-h, 52px))' }}>
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

          <div style={{ marginTop: 20, fontSize: 11.5, color: 'var(--ink-45)', fontStyle: 'italic' }}>{note}</div>
        </div>
      </div>
    </div>
  );
}
