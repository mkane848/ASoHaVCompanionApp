import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { PrintSheet, type MovesMode } from '../features/print/PrintSheet.js';
import styles from './PrintSheetPage.module.css';

/** The Moves reference cycles summary, then full, then off. */
const NEXT_MOVES: Record<MovesMode, MovesMode> = { summary: 'full', full: 'off', off: 'summary' };

/**
 * `/c/:campaignId/sheet/print` — the signed-in player's own sheet laid out for paper, read-only, and
 * `?blank=1` — the same sheet with writing lines where the values go, for paper play.
 *
 * Reads the same hooks as CharacterSheetPage (`useBootstrap`, `useLibrary`) and mutates nothing.
 * Lazy-loaded (App.tsx): none of this is in the first-load bundle. The blank variant needs only the
 * library, so it neither waits for the campaign nor requires a character.
 */
export default function PrintSheetPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [search] = useSearchParams();
  const blank = search.get('blank') === '1';
  const { data: boot, isLoading: bootLoading } = useBootstrap(blank ? undefined : campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();
  const [moves, setMoves] = useState<MovesMode>('summary');

  // Tells print-sheet CSS (and only it) that the app bar should go; before first paint, so it never flashes.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-print-sheet', '');
    return () => document.documentElement.removeAttribute('data-print-sheet');
  }, []);

  const sheet = blank ? null : (boot?.mySheet ?? null);
  const character = boot && sheet ? boot.characters.find((c) => c.Id === boot.membership.CharacterId) ?? null : null;

  // The browser names a saved PDF after the document title.
  useEffect(() => {
    const previous = document.title;
    document.title = blank ? 'Blank character sheet' : character ? `${character.Name} — character sheet` : 'Character sheet';
    return () => { document.title = previous; };
  }, [blank, character]);

  const back = `/c/${campaignId}/sheet`;
  const toolbar = (
    <div className={styles.toolbar}>
      <Link to={back} className={`tap-inline ${styles.tool}`}>Back</Link>
      <Link to={blank ? '.' : '?blank=1'} replace className={`tap-inline ${styles.tool}`}>{blank ? 'My sheet' : 'Blank sheet'}</Link>
      <button type="button" className={`tap-inline ${styles.tool}`} onClick={() => setMoves(NEXT_MOVES[moves])}>
        Moves: {moves}
      </button>
      <span className={styles.spacer} />
      <button type="button" className={`tap-inline ${styles.tool} ${styles.primary}`} onClick={() => window.print()}>Print</button>
    </div>
  );

  let body;
  if (libLoading || !library || (!blank && bootLoading)) {
    body = <p className={styles.message}>Loading…</p>;
  } else if (!blank && (!boot || !sheet)) {
    body = (
      <p className={styles.message}>
        {boot?.membership.Role === 'GM'
          ? "GMs don't keep a character sheet. Use “Blank sheet” to print an empty one."
          : "There's no character sheet to print on this campaign yet. Use “Blank sheet” to print an empty one."}
      </p>
    );
  } else {
    body = (
      <div className={styles.paper}>
        <PrintSheet
          library={library}
          sheet={sheet}
          character={character}
          party={blank ? null : (boot?.party ?? null)}
          bonds={blank ? [] : (boot?.bonds ?? [])}
          characters={blank ? [] : (boot?.characters ?? [])}
          moves={moves}
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
