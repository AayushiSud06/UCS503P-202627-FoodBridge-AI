import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { MSection, MDetail, MToggle } from './parts';

const DETAILS: [string, string][] = [
  ['Organisation', 'College Central Mess'],
  ['Default pickup', 'Thapar University, Patiala'],
  ['FSSAI licence', '1220…4471'],
  ['Contact', '+91 98765 43210'],
];

export default function DonorProfile() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState({ autoAccept: true, reminders: true, digest: false });
  const toggle = (k: keyof typeof prefs) => setPrefs(p => ({ ...p, [k]: !p[k] }));

  return (
    <>
      <section className="flex items-center gap-4 px-5 py-5 bg-white border-b border-gray-200">
        <span className="w-14 h-14 shrink-0 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg font-bold">
          AS
        </span>
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-lg text-gray-900 truncate">Aayushi Sharma</h2>
          <p className="text-sm text-gray-500 truncate">aayushi@thapar.edu</p>
          <span className="mt-1.5 m-chip bg-emerald-50 text-emerald-700">
            <ShieldCheck size={12} />
            Verified donor
          </span>
        </div>
      </section>

      <MSection title="Organisation" />
      {DETAILS.map(([k, v]) => (
        <MDetail key={k} label={k} value={v} />
      ))}

      <MSection title="Preferences" />
      <MToggle label="Auto-accept best match" checked={prefs.autoAccept} onChange={() => toggle('autoAccept')} />
      <MToggle label="Pickup reminders" checked={prefs.reminders} onChange={() => toggle('reminders')} />
      <MToggle label="Weekly impact digest" checked={prefs.digest} onChange={() => toggle('digest')} />

      <div className="p-5">
        <button type="button" className="m-btn-secondary" onClick={() => navigate('/m')}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );
}
