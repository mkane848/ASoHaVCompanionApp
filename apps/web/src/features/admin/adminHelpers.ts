import type { Library } from '@asohav/shared';

export function subtitleFor(view: string, obj: any, library: Library): string {
  const find = (coll: string, id: string) => ((library as any)[coll] as any[])?.find((x) => x.Id === id);
  if (view === 'quests') { const t = obj.ThemeId ? find('themes', obj.ThemeId) : null; return t ? t.Name : 'no theme'; }
  if (view === 'advancements') return `${obj.Track} · tier ${obj.Tier}`;
  if (view === 'items') return `${obj.LoadCost} load${obj.Charges ? ` · ${obj.Charges} charges` : ''}`;
  if (view === 'moves') { const v = obj.VirtueId ? find('virtues', obj.VirtueId) : null; return `${v ? v.Name : 'Any'} · ${obj.Kind || ''}`; }
  if (view === 'conditions') { const v = obj.VirtueId ? find('virtues', obj.VirtueId) : null; return v ? v.Name : 'no virtue'; }
  if (view === 'abilities') return obj.Acquisition || '';
  if (view === 'themes') return `${(obj.QuestIds || []).length} quests`;
  return obj.Tagline || '';
}
