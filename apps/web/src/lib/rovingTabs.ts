/** The tab a Left/Right/Home/End key moves to in a horizontal tablist (wrapping), or null for any
 *  other key. Pair with `tabIndex={selected ? 0 : -1}` on each tab: roving tabindex. */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight': return (current + 1) % count;
    case 'ArrowLeft': return (current - 1 + count) % count;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return null;
  }
}
