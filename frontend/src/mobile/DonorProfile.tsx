import { useState } from 'react';
import { LogOut } from 'lucide-react';

const DETAILS: [string, string][] = [
  ['Name', 'College Central Mess'],
  ['Default pickup', 'Thapar University'],
  ['FSSAI licence', '1220…4471'],
];

export default function DonorProfile() {
  const [prefs, setPrefs] = useState({ autoAccept: true, reminders: true, digest: false });

  const toggle = (k: keyof typeof prefs) => setPrefs(p => ({ ...p, [k]: !p[k] }));

  return (
    <>
      <section style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '16px 18px', borderBottom: '2px solid var(--color-divider)' }}>
        <div style={{ width: 56, height: 56, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-text)', color: 'var(--color-bg)', fontWeight: 800, fontSize: 18 }}>
          AS
        </div>
        <div>
          <h4>Aayushi Sharma</h4>
          <div className="m-muted">aayushi@thapar.edu</div>
          <span className="m-tag m-tag-accent" style={{ marginTop: 5 }}>Verified donor</span>
        </div>
      </section>

      <div className="m-sec"><h6>Organisation</h6></div>
      {DETAILS.map(([k, v]) => (
        <div key={k} style={{ padding: '12px 18px', borderTop: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'rgba(32,30,29,.6)' }}>{k}</span>
          <span style={{ fontWeight: 800, fontSize: 13, textAlign: 'right' }}>{v}</span>
        </div>
      ))}

      <div className="m-sec"><h6>Preferences</h6></div>
      {([
        ['autoAccept', 'Auto-accept best match'],
        ['reminders', 'Pickup reminders'],
        ['digest', 'Weekly impact digest'],
      ] as [keyof typeof prefs, string][]).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => toggle(key)}
          className="m-row"
          style={{ alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}
        >
          <span style={{ fontSize: 13 }}>{label}</span>
          <span
            style={{
              width: 38, height: 20, flex: 'none', padding: 2, display: 'flex',
              justifyContent: prefs[key] ? 'flex-end' : 'flex-start',
              background: prefs[key] ? 'var(--color-accent)' : 'transparent',
              border: prefs[key] ? 0 : '1px solid var(--color-divider)',
            }}
          >
            <span style={{ width: 16, height: 16, background: prefs[key] ? 'var(--color-bg)' : 'var(--color-neutral-400)' }} />
          </span>
        </button>
      ))}

      <div style={{ padding: 18, borderTop: '1px solid var(--color-divider)' }}>
        <button type="button" className="m-btn m-btn-secondary">
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );
}
