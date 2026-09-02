import { collections, buildGlossaryMatcher, findUnresolvedGlossaryTags, type Library, type ValidationIssue, type ReferencedByRow } from '@asohav/shared';

type AnyRecord = Record<string, any>;

function listOf(lib: Library, key: string): AnyRecord[] {
  return (lib as any)[key] ?? [];
}

function findIn(lib: Library, key: string, id: string): AnyRecord | undefined {
  return listOf(lib, key).find((x) => x.Id === id);
}

/** Every ref/multiref field pointing at something missing, plus empty required fields, plus
 *  (0.24.0) every explicit `[Tag]`/`[display][id-or-name]` glossary tag that doesn't resolve
 *  against the library's own glossary — a typo'd or dangling tag otherwise just renders as plain
 *  text forever with no signal back to the author. Built once against the glossary being
 *  validated, not the (possibly stale) matcher any particular client has cached. */
export function validateLibrary(lib: Library): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const glossaryMatcher = buildGlossaryMatcher(lib.glossary ?? []);
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
        if ((f.type === 'text' || f.type === 'textarea') && typeof obj[f.name] === 'string') {
          for (const tag of findUnresolvedGlossaryTags(obj[f.name], glossaryMatcher)) {
            issues.push({ collection: col.key, label: col.label, objectId: obj.Id, objectName: obj.Name || obj.Id, message: `${f.label || f.name} has an unresolved glossary tag [${tag}] — no term's Id, Name, or Alias matches it` });
          }
        }
        if (f.type === 'moveResults' && obj[f.name]) {
          const results = obj[f.name] as Record<string, { Description?: unknown; Options?: unknown; ChooseCount?: unknown }>;
          for (const tierKey of ['Tier3', 'Tier2', 'Tier1']) {
            const r = results[tierKey];
            if (!r || typeof r.Description !== 'string' || !r.Description.trim()) {
              issues.push({ collection: col.key, label: col.label, objectId: obj.Id, objectName: obj.Name || obj.Id, message: `${f.label || f.name} — ${tierKey} is missing a Description` });
              continue;
            }
            const options = Array.isArray(r.Options) ? r.Options : [];
            const chooseCount = typeof r.ChooseCount === 'number' ? r.ChooseCount : 0;
            if (chooseCount > options.length) {
              issues.push({ collection: col.key, label: col.label, objectId: obj.Id, objectName: obj.Name || obj.Id, message: `${f.label || f.name} — ${tierKey} asks to choose ${chooseCount} but only lists ${options.length} option(s)` });
            }
          }
        }
        if (col.key === 'moves' && f.name === 'HoldGrant' && obj[f.name]) {
          const grant = obj[f.name] as Record<string, unknown>;
          for (const [key, val] of Object.entries(grant)) {
            if (!['Tier3', 'Tier2', 'Tier1'].includes(key) || typeof val !== 'number') {
              issues.push({ collection: col.key, label: col.label, objectId: obj.Id, objectName: obj.Name || obj.Id, message: `HoldGrant has an invalid entry "${key}" — expected only Tier3/Tier2/Tier1 numbers` });
            }
          }
        }
      }
    }
  }
  issues.push(...validateImprovementDag(lib));
  return issues;
}

/** Improvement Trees (slice 4) are gated purely on their prerequisite DAG (see `Improvement`'s
 *  doc comment in `types.ts`) — a shape the generic ref/multiref/required checks above can't
 *  fully verify. Three things they can't catch: a `PrerequisiteIds` entry on a *different* tree
 *  (dangling-ref check only confirms the Id exists *somewhere* in `improvements`, not which
 *  tree), a prerequisite cycle (impossible to ever take any node in the loop), and a node with no
 *  path back to a Starting Improvement on its own tree (equally unreachable, whether or not it's
 *  part of a cycle). */
function validateImprovementDag(lib: Library): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const col = collections.find((c) => c.key === 'improvements');
  if (!col) return issues;
  const nodes = listOf(lib, 'improvements');
  const byId = new Map(nodes.map((n) => [n.Id, n]));

  for (const n of nodes) {
    for (const pid of (n.PrerequisiteIds ?? []) as string[]) {
      const p = byId.get(pid);
      if (p && p.TreeId !== n.TreeId) {
        issues.push({ collection: col.key, label: col.label, objectId: n.Id, objectName: n.Name || n.Id, message: `Prerequisites includes ${p.Name || pid}, which is on a different tree` });
      }
    }
  }

  // Cycle detection over the "requires" graph (white/gray/black DFS) — a loop of prerequisites
  // that never bottoms out at a Starting Improvement can never be entered by anyone.
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>(nodes.map((n) => [n.Id, WHITE]));
  const inCycle = new Set<string>();
  function visit(id: string, stack: string[]) {
    color.set(id, GRAY);
    stack.push(id);
    const n = byId.get(id);
    for (const pid of (n?.PrerequisiteIds ?? []) as string[]) {
      if (!byId.has(pid)) continue; // dangling ref already reported by the generic check
      const c = color.get(pid);
      if (c === GRAY) {
        // Found the back-edge that closes the loop — mark everyone from pid onward on the stack.
        const start = stack.indexOf(pid);
        for (const s of stack.slice(start)) inCycle.add(s);
      } else if (c === WHITE) {
        visit(pid, stack);
      }
    }
    stack.pop();
    color.set(id, BLACK);
  }
  for (const n of nodes) if (color.get(n.Id) === WHITE) visit(n.Id, []);
  for (const id of inCycle) {
    const n = byId.get(id)!;
    issues.push({ collection: col.key, label: col.label, objectId: id, objectName: n.Name || id, message: 'Is part of a prerequisite cycle — it can never actually be taken' });
  }

  // Reachability: every non-Starting node needs a chain of held prerequisites that eventually
  // bottoms out at a Starting Improvement on the SAME tree (cross-tree prereqs are already
  // flagged above, and are not treated as a valid path here).
  const reachable = new Map<string, boolean>();
  function reachesStarting(id: string, visiting: Set<string>): boolean {
    if (reachable.has(id)) return reachable.get(id)!;
    const n = byId.get(id);
    if (!n) return false;
    if (n.IsStarting) { reachable.set(id, true); return true; }
    if (visiting.has(id)) return false; // cycle — already reported above
    visiting.add(id);
    const ok = ((n.PrerequisiteIds ?? []) as string[]).some((pid) => {
      const p = byId.get(pid);
      return p && p.TreeId === n.TreeId && reachesStarting(pid, visiting);
    });
    visiting.delete(id);
    reachable.set(id, ok);
    return ok;
  }
  for (const n of nodes) {
    if (!n.IsStarting && !reachesStarting(n.Id, new Set())) {
      issues.push({ collection: col.key, label: col.label, objectId: n.Id, objectName: n.Name || n.Id, message: 'Not reachable from any Starting Improvement on its own tree' });
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
