import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api.js';

export default function LoginPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await api.auth.login(email, password);
      else await api.auth.register(name, email, password);
      await qc.invalidateQueries({ queryKey: ['me'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ width: 380, maxWidth: '100%', background: 'var(--panel)', border: '1px solid var(--rule)', borderTop: '2px solid var(--gold)', padding: '28px 30px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, margin: '0 0 4px' }}>ASoHaV</h1>
        <p style={{ margin: '0 0 22px', fontSize: 12.5, color: 'var(--ink-55)', fontStyle: 'italic' }}>
          A Story of Heroes and Villains — character sheet &amp; campaign companion.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
            </Field>
          )}
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
          </Field>

          {error && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>}

          <button
            className="tap-inline"
            type="submit"
            disabled={busy}
            style={{ marginTop: 6, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none', padding: '10px 16px' }}
          >
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          className="tap"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          style={{ marginTop: 14, background: 'transparent', border: 'none', color: 'var(--gold-dark)', fontSize: 12.5, padding: 0, textDecoration: 'underline' }}
        >
          {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 10.5, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--ink-45)', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  background: '#fff',
  border: '1px solid var(--rule-field)',
  fontSize: 13.5,
  padding: '8px 10px',
  outline: 'none',
};
