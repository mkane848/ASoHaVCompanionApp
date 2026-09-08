/**
 * The hit-area assertions, shared between the at-rest responsive smoke test and the
 * interaction-state pass (0.41.0).
 *
 * Extracted rather than copied. `responsive-smoke.mjs` owned this logic alone until an
 * interaction pass needed exactly the same arithmetic, and two copies of a 2px overlap
 * tolerance and a `::after`-aware rect are two copies that drift — the same reasoning that
 * put VIEWPORTS/ROUTES in `harnessConfig.mjs` rather than in both scripts.
 *
 * `collect` is handed to `page.evaluate`, so it must stay a self-contained function that closes
 * over nothing: Playwright serialises the source and runs it in the page, where this module's
 * scope does not exist. That is why `tapMin`/`eps` arrive as arguments rather than being read
 * from the constants below.
 */

export const TAP_MIN = 44;
/** Sub-pixel slack: layout rounding can land a 44px box on 43.6. */
export const EPS = 0.6;

/** Runs in the page. Mirrors how the browser actually routes a tap. */
export function collect({ tapMin, eps, scope = null }) {
  function hitRect(el) {
    const base = el.getBoundingClientRect();
    const after = getComputedStyle(el, '::after');
    if (after.content === 'none' || !after.width || after.width === 'auto') return base;
    const w = parseFloat(after.width);
    const h = parseFloat(after.height);
    if (!w || !h) return base;
    const cx = base.left + base.width / 2;
    const cy = base.top + base.height / 2;
    const width = Math.max(w, base.width);
    const height = Math.max(h, base.height);
    return { left: cx - width / 2, right: cx + width / 2, top: cy - height / 2, bottom: cy + height / 2, width, height };
  }

  const label = (el) =>
    (el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.tagName)
      .trim()
      .slice(0, 32) || el.tagName;

  /* `scope` is what makes this reusable for an open modal or drawer. Without it the query would
     also collect every control on the page *behind* the backdrop — which a user cannot reach,
     and which overlaps the dialog by definition, so an unscoped run over an open modal reports a
     flood of overlaps that are not bugs. Scoping to the dialog measures what is actually
     tappable. Defaults to the whole document, which is the at-rest case. */
  const root = scope ? document.querySelector(scope) : document;
  if (!root) return { missingScope: true, controls: 0, rendered: false, small: [], overlaps: [], overlapCount: 0, overflow: null, rootChildren: 0 };

  const controls = Array.from(root.querySelectorAll('button, a, input, select, textarea')).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });

  const small = [];
  const rects = [];
  for (const el of controls) {
    const r = hitRect(el);
    rects.push({ el, r });
    if (r.height < tapMin - eps || r.width < tapMin - eps) {
      small.push({ label: label(el), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }

  const overlaps = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].r;
      const b = rects[j].r;
      // 2px of tolerance: shared borders and rounding produce hairline touches
      // that no finger can land in.
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 2 && oy > 2) {
        overlaps.push({ a: label(rects[i].el), b: label(rects[j].el), by: `${Math.round(ox)}x${Math.round(oy)}` });
      }
    }
  }

  const doc = document.documentElement;
  const appRoot = document.getElementById('root');
  return {
    missingScope: false,
    controls: controls.length,
    rootChildren: appRoot ? appRoot.childElementCount : 0,
    rendered: !!appRoot && appRoot.childElementCount > 0 && (appRoot.textContent || '').trim().length > 0,
    // Always document-level: a modal that pushes the *page* wide is still a horizontal-overflow
    // bug, and scoping this to the dialog would hide exactly that.
    overflow: doc.scrollWidth > doc.clientWidth + 1 ? { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth } : null,
    small,
    overlaps: overlaps.slice(0, 8),
    overlapCount: overlaps.length,
  };
}
