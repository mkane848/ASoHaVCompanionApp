import { useModalA11y } from '../lib/useModalA11y.js';
import modal from '../styles/modal.module.css';
import styles from './AboutModal.module.css';

const REPO_URL = 'https://github.com/mkane848/ASoHaVCompanionApp';
const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;

function formattedReleaseDate(): string | null {
  if (!__APP_RELEASE_DATE__) return null;

  // Full timestamp ("YYYY-MM-DDTHH:MM:SSZ", 0.4.0 and later): the trailing Z makes it
  // unambiguous, so handing it straight to Date and formatting in the viewer's own locale/zone
  // is safe.
  if (__APP_RELEASE_DATE__.includes('T')) {
    return new Date(__APP_RELEASE_DATE__).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }

  // Legacy date-only entries ("YYYY-MM-DD", before 0.4.0): parsed via explicit y/m/d components
  // rather than `new Date('2026-08-02')`, which parses a date-only ISO string as UTC midnight —
  // in a timezone behind UTC that prints as the previous day.
  const [y, m, d] = __APP_RELEASE_DATE__.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function AboutModal({ onClose }: { onClose: () => void }) {
  const releaseDate = formattedReleaseDate();
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="about-title" className={modal.title}>A Story of Heroes and Villains</h2>
          <p className={styles.version}>
            v{__APP_VERSION__}
            {releaseDate ? ` — released ${releaseDate}` : ''}
          </p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>Credits</div>
          <div>Ryan McGilloway — Director</div>
          <div>Mike Kane — Designer &amp; Programmer</div>
        </div>

        <div className={styles.lineage}>
          ASoHaV is Powered by the Apocalypse, built on the Apocalypse Engine design lineage originated
          by D. Vincent Baker and Meguey Baker (<i>Apocalypse World</i>). That credit covers the general
          moves-based system; the Virtues, Moves, Arcs, Bonds, and every other piece of rules and
          setting content are original to this game.
        </div>

        <div className={`tap-row ${styles.links}`}>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={`tap-inline ${styles.link}`}>
            Repository ↗
          </a>
          <a href={CHANGELOG_URL} target="_blank" rel="noreferrer" className={`tap-inline ${styles.link}`}>
            Changelog ↗
          </a>
        </div>

        <div className={styles.footer}>
          <button className={`tap-inline ${modal.secondaryAction}`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
