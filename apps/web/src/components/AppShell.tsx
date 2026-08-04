import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MeResponse } from '@asohav/shared';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import styles from './AppShell.module.css';
import { AboutModal } from './AboutModal.js';

export default function AppShell({ me, children }: { me: MeResponse; children: ReactNode }) {
  const qc = useQueryClient();
  const barRef = useRef<HTMLDivElement>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  /* Publish the bar's height as --app-bar-h. Content Admin's panes size
     themselves against it; that offset used to be hardcoded at 52px, which is
     wrong on narrow phones where the bar wraps and stands 93px tall. */
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty('--app-bar-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={styles.shell}>
      <div ref={barRef} className={`app-bar ${styles.bar}`}>
        <Link to="/" className={`app-bar__brand tap ${styles.brand}`}>
          <span className={styles.brandLong}>A Story of Heroes and Villains</span>
          <span className={styles.brandShort}>ASoHaV</span>
        </Link>
        {me.user.IsAdmin && (
          <Link to="/admin" className={`tap ${styles.navLink}`}>
            <span className={styles.adminLong}>Content Admin</span>
            <span className={styles.adminShort}>Admin</span>
          </Link>
        )}
        <button className={`tap ${styles.navButton}`} onClick={() => setAboutOpen(true)}>
          About
        </button>
        <span className={`app-bar__who ${styles.who}`}>
          {me.user.Name}
        </span>
        <button
          className={`tap ${styles.signOut}`}
          onClick={() => api.auth.logout().then(() => qc.invalidateQueries({ queryKey: ['me'] }))}
        >
          Sign out
        </button>
      </div>
      {children}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
  );
}

