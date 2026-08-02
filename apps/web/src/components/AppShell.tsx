import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MeResponse } from '@asohav/shared';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export default function AppShell({ me, children }: { me: MeResponse; children: ReactNode }) {
  const qc = useQueryClient();

  return (
    <div style={{ minHeight: '100vh' }}>
      <div
        style={{
          background: 'var(--ink)',
          color: 'var(--ink-on-dark)',
          padding: '10px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Link to="/" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--ink-on-dark)', textDecoration: 'none', marginRight: 'auto' }}>
          ASoHaV
        </Link>
        {me.user.IsAdmin && (
          <Link to="/admin" style={navLinkStyle}>
            Content Admin
          </Link>
        )}
        <span style={{ fontSize: 12, opacity: 0.7 }}>{me.user.Name}</span>
        <button
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
