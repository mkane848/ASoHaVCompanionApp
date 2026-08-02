import { Link } from 'react-router-dom';
import type { MeResponse } from '@asohav/shared';

export default function HomePage({ me }: { me: MeResponse }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>
        Welcome, {me.user.Name}.
      </h1>
      <p style={{ color: 'var(--ink-55)', fontStyle: 'italic', margin: '0 0 24px' }}>Your campaigns.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {me.memberships.map((m) => (
          <div key={m.Id} style={{ background: 'var(--panel)', border: '1px solid var(--rule)', borderTop: '2px solid var(--gold)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>{m.CampaignName}</span>
              <span style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold-dark)' }}>{m.Role}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <Link to={`/c/${m.CampaignId}`} style={linkButton}>
                Open campaign
              </Link>
              {m.Role === 'Player' && m.CharacterId && (
                <Link to={`/c/${m.CampaignId}/sheet`} style={linkButton}>
                  Open character sheet
                </Link>
              )}
            </div>
          </div>
        ))}
        {me.memberships.length === 0 && <p style={{ fontStyle: 'italic', color: 'var(--ink-55)' }}>No campaigns yet.</p>}
      </div>
    </div>
  );
}

const linkButton = {
  fontSize: 11,
  letterSpacing: '.1em',
  textTransform: 'uppercase' as const,
  background: 'var(--ink)',
  color: 'var(--ink-on-dark)',
  textDecoration: 'none',
  padding: '8px 14px',
};
