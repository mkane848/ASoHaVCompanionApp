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
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(42,32,26,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--panel)', border: '1px solid var(--rule)', borderTop: '3px solid var(--gold)', maxWidth: 460, width: '100%', animation: 'fadeUp .2s ease-out' }}
      >
        <div style={{ padding: '24px 24px 4px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 26, margin: '0 0 4px' }}>A Story of Heroes and Villains</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-55)' }}>
            v{__APP_VERSION__}
            {releaseDate ? ` — released ${releaseDate}` : ''}
          </p>
        </div>

        <div style={{ padding: '16px 24px 4px', fontSize: 13.5, lineHeight: 1.7 }}>
          <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-45)', marginBottom: 6 }}>Credits</div>
          <div>Ryan McGilloway — Director</div>
          <div>Mike Kane — Designer &amp; Programmer</div>
        </div>

        <div style={{ padding: '16px 24px 4px', fontSize: 12.5, lineHeight: 1.7, color: 'var(--ink-55)' }}>
          ASoHaV is Powered by the Apocalypse, built on the Apocalypse Engine design lineage originated
          by D. Vincent Baker and Meguey Baker (<i>Apocalypse World</i>). That credit covers the general
          moves-based system; the Virtues, Moves, Arcs, Bonds, and every other piece of rules and
          setting content are original to this game.
        </div>

        <div style={{ padding: '16px 24px 4px', display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12.5 }}>
          <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--ink)' }}>
            Repository ↗
          </a>
          <a href={CHANGELOG_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--ink)' }}>
            Changelog ↗
          </a>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          <button
            onClick={onClose}
            style={{ width: '100%', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--ink-25)', color: 'rgba(42,32,26,.6)', padding: 9 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
