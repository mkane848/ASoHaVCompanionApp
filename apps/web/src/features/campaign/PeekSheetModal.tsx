import { useId } from 'react';
import type { CampaignBootstrap, Character, CharacterSheet, Library } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { VirtuesPanel } from '../sheet/VirtuesPanel.js';
import { StatusesPanel } from '../sheet/StatusesPanel.js';
import { RemindersPanel } from '../sheet/RemindersPanel.js';
import { BackgroundPanel } from '../sheet/BackgroundPanel.js';
import { LoadPanel } from '../sheet/LoadPanel.js';
import modal from '../../styles/modal.module.css';
import styles from './PeekSheetModal.module.css';

/** The GM's read-only view of one player's sheet, opened from that player's PeekCard — a popup
 *  rather than a page, since there is nothing to do there but read. Data comes from
 *  `boot.peekSheets` (GM-only, already sent by the bootstrap route and kept live by the campaign's
 *  Realtime subscription), so opening it makes no request and it updates as the player plays.
 *
 *  The body is the sheet's own panels with `readOnly`, not a separate summary layout — the repo
 *  owner's choice, so the popup can't drift from the sheet as the sheet evolves. Nothing here can
 *  write: the panels get no `commit` (a GM's sheet save would 403 anyway), no Party writer and no
 *  Hold hook, and a read-only panel writes through a no-op even if one were passed. Advancement,
 *  Connections and the Party playbook are omitted: they're party-level, and the GM sees them on the
 *  Campaign and Party pages. Order and pairing follow CharacterSheetPage's `.sheet-grid`. */
export function PeekSheetModal({
  character,
  sheet,
  boot,
  library,
  onClose,
}: {
  character: Character;
  sheet: CharacterSheet;
  boot: CampaignBootstrap;
  library: Library;
  onClose: () => void;
}) {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const titleId = useId();
  const noteId = useId();
  // The account's display name first, since that's what the GM sees on the roster; the name typed
  // at character creation is the fallback for a user row the bootstrap didn't include.
  const playerName = boot.users.find((u) => u.Id === character.UserId)?.Name || character.PlayerName;
  const meta = [character.Pronouns, playerName && `Played by ${playerName}`].filter(Boolean).join(' · ');
  const motifs = sheet.Motifs.map((m) => m.Name).filter(Boolean).join(' · ');

  return (
    <div className={`${modal.backdrop} ${styles.backdrop}`} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={noteId}
        tabIndex={-1}
      >
        <div className={styles.head}>
          <div className={styles.identity}>
            <span className={styles.badge}>Read-only</span>
            <h2 id={titleId} className={styles.title}>{character.Name}</h2>
            {meta && <p className={styles.meta}>{meta}</p>}
            {motifs && <p className={styles.motifs}>{motifs}</p>}
            <p id={noteId} className={styles.note}>
              {character.Name}&rsquo;s sheet as they see it, live. Only the player can change it.
            </p>
          </div>
          {/* First focusable in the dialog, so useModalA11y lands focus here on open. */}
          <button type="button" className={`tap-inline ${styles.close}`} onClick={onClose}>
            Close
          </button>
        </div>

        <div className={styles.body}>
          <div className="sheet-grid">
            <div className="sheet-col">
              <VirtuesPanel sheet={sheet} library={library} readOnly />
            </div>
            <div className="sheet-col">
              <StatusesPanel sheet={sheet} library={library} readOnly />
              <RemindersPanel sheet={sheet} readOnly />
            </div>
          </div>
          <BackgroundPanel sheet={sheet} library={library} readOnly />
          <LoadPanel sheet={sheet} library={library} readOnly />
        </div>
      </div>
    </div>
  );
}
