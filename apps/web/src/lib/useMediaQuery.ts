import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

/** Breakpoints, mirroring the tokens in styles/layout.css. Anything that can be
 *  done in CSS should be — this is for the cases where the *structure* changes,
 *  not just the styling (Content Admin's drill-down renders one pane instead of
 *  three, so there is nothing for a media query to hide). */
export const BP = { sm: 600, md: 768, lg: 1024 } as const;

export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  };
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // SSR/first paint: assume the wide layout, same as the CSS default
  );
}

/** True below `px` — i.e. the narrow side of the breakpoint. */
export function useNarrowerThan(px: number): boolean {
  return useMediaQuery(`(max-width: ${px - 0.02}px)`);
}

/** Publishes an element's height as the `--sticky-h` custom property on :root.
 *
 *  Panels set `scroll-margin-top: var(--sticky-h)` so that in-page anchor jumps
 *  clear the sticky header. The height can't be hardcoded: the header wraps on
 *  narrow viewports, running from 58px at desktop widths to 162px at 360px. */
export function useStickyHeaderHeight(ref: RefObject<HTMLElement | null>): void {
  const [, force] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      force((n) => n + 1); // ref wasn't attached on the first pass; retry once
      return;
    }
    const publish = () => {
      document.documentElement.style.setProperty('--sticky-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--sticky-h');
    };
  }, [ref]);
}

/** Tracks whether a horizontally-scrolling element has more content off-screen to the left
 *  and/or right, publishing that as `data-can-scroll-left`/`data-can-scroll-right` attributes
 *  on the element itself so CSS can mask a fade in only on the edge(s) that are actually
 *  scrollable — see the `.sheet-nav` scroll-affordance rule in layout.css (WorkPlan-0.25.0.md's
 *  C5: below 768px the section nav becomes a `overflow-x: auto` strip with no visible sign it
 *  scrolls, so a label sliced mid-word at the right edge read as broken rather than
 *  continuable). Re-measures on scroll and on resize (a rotation or a font swap can change
 *  `scrollWidth` without a scroll event firing). */
export function useScrollEdgeFade(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publish = () => {
      const canScrollLeft = el.scrollLeft > 0;
      // -1px tolerance: some browsers report a fractional scrollLeft/scrollWidth that never
      // quite reaches the exact max, which would otherwise leave the right fade stuck on.
      const canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      el.toggleAttribute('data-can-scroll-left', canScrollLeft);
      el.toggleAttribute('data-can-scroll-right', canScrollRight);
    };
    publish();
    el.addEventListener('scroll', publish, { passive: true });
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', publish);
      ro.disconnect();
    };
  }, [ref]);
}
