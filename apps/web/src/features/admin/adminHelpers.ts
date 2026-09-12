import type { Library } from '@asohav/shared';

/** One record in a library collection. Content Admin is generic over all fourteen collections by
 *  design, so it reads them by key rather than by name — the widening that needs lives here, once,
 *  instead of as an `as any` at each of the half-dozen places that walk a collection. */
export type LibRow = Record<string, unknown> & { Id: string; Name?: string };

export function rowsOf(library: Library, key: string): LibRow[] {
  return (library as unknown as Record<string, LibRow[]>)[key] ?? [];
}

export function subtitleFor(view: string, obj: any, library: Library): string {
  const find = (coll: string, id: string) => ((library as any)[coll] as any[])?.find((x) => x.Id === id);
  if (view === 'improvementTrees') return `${obj.Category} tree`;
  if (view === 'improvements') {
    const tree = obj.TreeId ? find('improvementTrees', obj.TreeId) : null;
    const prereqCount = (obj.PrerequisiteIds || []).length;
    return `${tree ? tree.Name : 'no tree'} · ${obj.IsStarting ? 'starting' : `${prereqCount} prereq${prereqCount === 1 ? '' : 's'}`}`;
  }
  if (view === 'items') return `${obj.LoadCost} load${obj.Charges ? ` · ${obj.Charges} charges` : ''}`;
  if (view === 'moves') { const v = obj.VirtueId ? find('virtues', obj.VirtueId) : null; return `${v ? v.Name : 'Any'} · ${obj.Kind || ''}`; }
  if (view === 'conditions') { const v = obj.VirtueId ? find('virtues', obj.VirtueId) : null; return v ? v.Name : 'no virtue'; }
  if (view === 'glossary') return (obj.Definition || '').slice(0, 60) + ((obj.Definition || '').length > 60 ? '…' : '');
  if (view === 'motifs') return `${(obj.SkillTagExamples || []).length} skills · ${(obj.FlawTagExamples || []).length} flaws`;
  return obj.Tagline || '';
}
