import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MeResponse } from '@asohav/shared';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export default function AppShell({ me, children }: { me: MeResponse; children: ReactNode }) {
  const qc = useQueryClient();
  const barRef = useRef<HTMLDivElement>(null);

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
    <div style={{ minHeight: '100dvh' }}>
      <div ref={barRef} className="app-bar" style={{ background: 'var(--ink)', color: 'var(--ink-on-dark)' }}>
        <Link
          to="/"
          className="app-bar__brand tap"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink-on-dark)', textDecoration: 'none', marginRight: 'auto' }}
        >
          ASoHaV
        </Link>
        {me.user.IsAdmin && (
          <Link to="/admin" className="tap" style={navLinkStyle}>
            Content Admin
          </Link>
        )}
        <span className="app-bar__who" style={{ fontSize: 12, opacity: 0.7 }}>
          {me.user.Name}
        </span>
        <button
          className="tap"
          onClick={() => api.auth.logout().then(() => qc.invalidateQueries({ queryKey: ['me'] }))}
          style={{
            fontSize: 11,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,.3)',
            color: 'var(--ink-on-dark)',
            padding: '6px 12px',
          }}
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  );
}

const navLinkStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--ink-on-dark)',
  textDecoration: 'none',
  opacity: 0.85,
};
