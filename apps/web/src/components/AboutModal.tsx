import modal from '../styles/modal.module.css';
import styles from './AboutModal.module.css';

const REPO_URL = 'https://github.com/mkane848/ASoHaVCompanionApp';
const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;

function formattedReleaseDate(): string | null {
  if (!__APP_RELEASE_DATE__) return null;
  const [y, m, d] = __APP_RELEASE_DATE__.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function AboutModal({ onClose }: { onClose: () => void }) {
  const releaseDate = formattedReleaseDate();

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <h2 className={modal.title}>A Story of Heroes and Villains</h2>
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
