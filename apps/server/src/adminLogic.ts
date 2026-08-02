import { collections, type Library, type ValidationIssue, type ReferencedByRow } from '@asohav/shared';

type AnyRecord = Record<string, any>;

function listOf(lib: Library, key: string): AnyRecord[] {
  return (lib as any)[key] ?? [];
}

function findIn(lib: Library, key: string, id: string): AnyRecord | undefined {
  return listOf(lib, key).find((x) => x.Id === id);
}

/** Every ref/multiref field pointing at something missing, plus empty required fields. */
export function validateLibrary(lib: Library): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const col of collections) {
    for (const obj of listOf(lib, col.key)) {
      for (const f of col.fields) {
        if (f.type === 'ref' && obj[f.name]) {
          if (!f.collection || !findIn(lib, f.collection, obj[f.name])) {
            issues.push({ collection: col.key, label: col.label, objectId: obj.Id, objectName: obj.Name || obj.Id, message: `${f.label || f.name} points at a missing ${f.collection} (${obj[f.name]})` });
          }
        }
        if (f.type === 'multiref' && Array.isArray(obj[f.name])) {
          for (const rid of obj[f.name]) {
            if (!f.collection || !findIn(lib, f.collection, rid)) {
              issues.push({ collection: col.key, label: col.label, objectId: obj.Id, objectName: obj.Name || obj.Id, message: `${f.label || f.name} includes a missing ${f.collection} (${rid})` });
            }
          }
        }
        if (f.required && !obj[f.name]) {
          issues.push({ collection: col.key, label: col.label, objectId: obj.Id, objectName: obj.Name || obj.Id, message: `${f.label || f.name} is required but empty` });
        }
      }
    }
  }
  return issues;
}

/** What would break if `id` in `collection` were deleted. */
export function referencedBy(lib: Library, collection: string, id: string): ReferencedByRow[] {
  const out: ReferencedByRow[] = [];
  for (const col of collections) {
    for (const obj of listOf(lib, col.key)) {
      for (const f of col.fields) {
        const isRef = f.type === 'ref' && f.collection === collection && obj[f.name] === id;
        const isMulti = f.type === 'multiref' && f.collection === collection && Array.isArray(obj[f.name]) && obj[f.name].includes(id);
        if (isRef || isMulti) out.push({ label: col.label, name: obj.Name || obj.Id, field: f.label || f.name });
      }
    }
  }
  return out;
}

/** Field-level diff for the change-history view. */
export function diffEntry(before: unknown, after: unknown): { field: string; before: string; after: string }[] {
  const a = (before as AnyRecord) || {};
  const b = (after as AnyRecord) || {};
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).filter((k) => k !== 'Id');
  const out: { field: string; before: string; after: string }[] = [];
  for (const k of keys) {
    const av = JSON.stringify(a[k]);
    const bv = JSON.stringify(b[k]);
    if (av !== bv) out.push({ field: k, before: av === undefined ? '—' : av, after: bv === undefined ? '—' : bv });
  }
  return out;
}
