import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { PrintGmReference } from '../features/print/PrintGmReference.js';
// The toolbar, message and paper styles are the character sheet's, not a copy of them.
import styles from './PrintSheetPage.module.css';

/**
 * `/c/:campaignId/gm-reference/print` — the GM Reference laid out for paper, read-only.
 *
 * GM-only the way the drawer it prints is: `CampaignPage` mounts `GmReferenceDrawer` only when
 * `boot.membership.Role === 'GM'`, and this page checks the same field. That gate is UX consistency,
 * not secrecy: the Library (GM Reference included) is readable by any signed-in user, so a player
 * who fetched `/api/library` could read the same text. A non-GM here gets a plain message and the
 * reference is never rendered.
 *
 * Lazy-loaded (App.tsx), and reached from the (also lazy) drawer, so none of it is in the
 * first-load bundle.
 */
export default function PrintGmReferencePage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const location = useLocation();
  const { data: boot, isLoading: bootLoading, isError } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  // Tells print CSS (and only it) that the app bar should go and which @page applies; before first paint.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-print-sheet', '');
    root.setAttribute('data-print-gm', '');
    return () => {
      root.removeAttribute('data-print-sheet');
      root.removeAttribute('data-print-gm');
    };
  }, []);

  const isGM = boot?.membership.Role === 'GM';

  // The browser names a saved PDF after the document title.
  useEffect(() => {
    const previous = document.title;
    document.title = isGM && boot ? `${boot.campaign.Name} — GM Reference` : 'GM Reference';
    return () => { document.title = previous; };
  }, [isGM, boot]);

  const sections = useMemo(
    () => (library ? [...library.gmReference].sort((a, b) => a.Order - b.Order) : []),
    [library],
  );

  // Back goes where the drawer was opened from (Campaign or Adventure Prep), else the campaign page.
  const from = (location.state as { from?: string } | null)?.from;
  const back = from && from.startsWith(`/c/${campaignId}`) ? from : `/c/${campaignId}`;

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const toolbar = (
    <div className={styles.toolbar}>
      <Link to={back} className={`tap-inline ${styles.tool}`}>Back</Link>
      {isGM &&
        sections.map((s) => (
          <button
            key={s.Id}
            type="button"
            aria-pressed={!hidden.has(s.Id)}
            className={`tap-inline ${styles.tool}`}
            onClick={() => toggle(s.Id)}
          >
            {hidden.has(s.Id) ? 'Include' : 'Skip'}: {s.Name}
          </button>
        ))}
      <span className={styles.spacer} />
      {isGM && (
        <button type="button" className={`tap-inline ${styles.tool} ${styles.primary}`} onClick={() => window.print()}>Print</button>
      )}
    </div>
  );

  let body;
  if (bootLoading || libLoading || (!library && !isError)) {
    body = <p className={styles.message}>Loading…</p>;
  } else if (isError && !boot) {
    body = <p className={styles.message}>Couldn&rsquo;t load this campaign.</p>;
  } else if (!isGM || !boot || !library) {
    body = <p className={styles.message}>GM only. The GM Reference prints for this campaign&rsquo;s GM.</p>;
  } else {
    body = (
      <div className={styles.paper}>
        <PrintGmReference
          library={library}
          campaignName={boot.campaign.Name}
          hidden={hidden}
          printedOn={new Date().toLocaleDateString()}
        />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {toolbar}
      {body}
    </div>
  );
}
