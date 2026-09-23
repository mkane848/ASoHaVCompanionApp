/** Parses a GM Reference Body string into structured blocks.
 *
 * Format: plain text with blocks separated by blank lines (\n\n). Lines starting
 * with "- " are list items, nested by two-space indentation. Other lines are
 * paragraph text; consecutive text lines in one block show one per line.
 */
export interface GmReferenceBlock {
  type: 'paragraph' | 'list';
  lines?: string[];
  items?: GmReferenceListItem[];
}

export interface GmReferenceListItem {
  level: number;
  text: string;
  children?: GmReferenceListItem[];
}

export function parseGmReferenceBody(body: string): GmReferenceBlock[] {
  if (!body.trim()) return [];

  const blocks: GmReferenceBlock[] = [];
  for (const blockStr of body.split('\n\n')) {
    // A block can hold text lines and list items in any order (the body is admin-editable), so
    // each run of consecutive text lines becomes a paragraph and each run of list items a list —
    // no line is dropped.
    let run: string[] = [];
    let runIsList = false;
    const flush = () => {
      if (run.length === 0) return;
      if (runIsList) {
        const items = parseListItems(run);
        if (items.length > 0) blocks.push({ type: 'list', items });
      } else {
        blocks.push({ type: 'paragraph', lines: run });
      }
      run = [];
    };
    for (const line of blockStr.split('\n')) {
      if (!line.trim()) continue;
      const isList = /^\s*- /.test(line);
      if (run.length > 0 && isList !== runIsList) flush();
      runIsList = isList;
      run.push(line);
    }
    flush();
  }

  return blocks;
}

function parseListItems(lines: string[]): GmReferenceListItem[] {
  const items: GmReferenceListItem[] = [];
  const stack: GmReferenceListItem[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const match = line.match(/^(\s*)- (.+)$/);
    if (!match) continue;

    const indent = match[1].length;
    const level = indent / 2;
    const text = match[2];

    const item: GmReferenceListItem = { level, text };

    // Find the right parent based on level
    while (stack.length > 0 && stack[stack.length - 1]!.level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      items.push(item);
    } else {
      const parent = stack[stack.length - 1]!;
      if (!parent.children) parent.children = [];
      parent.children.push(item);
    }

    stack.push(item);
  }

  return items;
}
