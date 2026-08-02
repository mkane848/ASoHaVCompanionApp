import { useState } from 'react';

export function ForgeBondModal({ partnerName, onSubmit, onClose }: { partnerName: string; onSubmit: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(42,32,26,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--rule)', borderTop: '3px solid var(--gold)', maxWidth: 560, width: '100%', maxHeight: '84dvh', overflowY: 'auto', animation: 'fadeUp .2s ease-out' }}>
        <div style={{ padding: '20px 24px 12px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 26, margin: '0 0 4px' }}>Forge a Bond</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-55)', fontStyle: 'italic' }}>
            You and {partnerName} write this move together. Both of you must agree to the wording.
          </p>
        </div>
        <div style={{ padding: '0 24px 20px' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Write the move the two of you have earned — what it triggers on, and what it does…"
            style={{ width: '100%', background: 'transparent', border: '1px solid var(--rule-field)', fontSize: 13.5, lineHeight: 1.6, padding: 10, resize: 'vertical', outline: 'none' }}
          />
          <button
            className="tap-inline"
            onClick={() => { const t = text.trim(); if (t) onSubmit(t); }}
            style={{ width: '100%', marginTop: 10, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'var(--ink)', color: 'var(--ink-on-dark)', border: 'none', padding: 10 }}
          >
            Propose the Forge
          </button>
          <button
            className="tap-inline"
            onClick={onClose}
            style={{ width: '100%', marginTop: 8, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--ink-25)', color: 'rgba(42,32,26,.6)', padding: 9 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
