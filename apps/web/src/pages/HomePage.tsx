import { Link } from 'react-router-dom';
import type { MeResponse } from '@asohav/shared';
import styles from './HomePage.module.css';

export default function HomePage({ me }: { me: MeResponse }) {
  return (
    <div className={styles.page}>
      <h1 className={styles.greeting}>Welcome, {me.user.Name}.</h1>
      <p className={styles.subtitle}>Your campaigns.</p>

      <div className={styles.list}>
        {me.memberships.map((m) => (
          <div key={m.Id} className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.name}>{m.CampaignName}</span>
              <span className={styles.role}>{m.Role}</span>
            </div>
            <div className={`tap-row ${styles.links}`}>
              <Link to={`/c/${m.CampaignId}`} className={`tap-inline ${styles.link}`}>
                Open campaign
              </Link>
              {m.Role === 'Player' && m.CharacterId && (
                <Link to={`/c/${m.CampaignId}/sheet`} className={`tap-inline ${styles.link}`}>
                  Open character sheet
                </Link>
              )}
            </div>
          </div>
        ))}
        {me.memberships.length === 0 && <p className={styles.empty}>No campaigns yet.</p>}
      </div>
    </div>
  );
}
