import type { Library } from '@asohav/shared';

export function subtitleFor(view: string, obj: any, library: Library): string {
  const find = (coll: string, id: string) => ((library as any)[coll] as any[])?.find((x) => x.Id === id);
  if (view === 'advancements') return `${obj.Track} · tier ${obj.Tier}`;
  if (view === 'items') return `${obj.LoadCost} load${obj.Charges ? ` · ${obj.Charges} charges` : ''}`;
  if (view === 'moves') { const v = obj.VirtueId ? find('virtues', obj.VirtueId) : null; return `${v ? v.Name : 'Any'} · ${obj.Kind || ''}`; }
  if (view === 'conditions') { const v = obj.VirtueId ? find('virtues', obj.VirtueId) : null; return v ? v.Name : 'no virtue'; }
  if (view === 'glossary') return (obj.Definition || '').slice(0, 60) + ((obj.Definition || '').length > 60 ? '…' : '');
  if (view === 'motifs') return `${(obj.SkillTagExamples || []).length} skills · ${(obj.FlawTagExamples || []).length} flaws`;
  return obj.Tagline || '';
}
