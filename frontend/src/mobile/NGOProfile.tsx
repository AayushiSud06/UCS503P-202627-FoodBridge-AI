import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, LogOut, ShieldCheck } from 'lucide-react';
import { MOCK_RECIPIENTS } from '../data/mockData';
import { MSection, MDetail, MToggle } from './parts';

const RECIPIENT = MOCK_RECIPIENTS[0];

export default function NGOProfile() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState({ pushMatches: true, onlyMatching: false, digest: true });
  const toggle = (k: keyof typeof prefs) => setPrefs(p => ({ ...p, [k]: !p[k] }));

  return (
    <>
      <section className="flex items-center gap-4 px-5 py-5 bg-white border-b border-gray-200">
        <span className="w-14 h-14 shrink-0 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg font-bold">
          HH
        </span>
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-lg text-gray-900 truncate">
            {RECIPIENT.name}
          </h2>
          <p className="text-sm text-gray-500 truncate">{RECIPIENT.contactPerson}</p>
          <span className="mt-1.5 m-chip bg-emerald-50 text-emerald-700">
            <ShieldCheck size={12} />
            Verified recipient
          </span>
        </div>
      </section>

      <MSection title="Organisation" />
      <MDetail label="Type" value={RECIPIENT.type} />
      <MDetail label="Location" value={RECIPIENT.location} />
      <MDetail label="Daily capacity" value={`${RECIPIENT.capacity} meals`} />
      <MDetail label="Reliability" value={`${RECIPIENT.reliabilityScore}%`} />
      <MDetail label="Donations accepted" value={RECIPIENT.acceptedDonations} />
      <MDetail label="Contact" value={RECIPIENT.phone} />

      <MSection title="Notifications" />
      <MToggle
        label="Push new matches"
        checked={prefs.pushMatches}
        onChange={() => toggle('pushMatches')}
      />
      <MToggle
        label="Only alert above 85% match"
        checked={prefs.onlyMatching}
        onChange={() => toggle('onlyMatching')}
      />
      <MToggle label="Weekly intake digest" checked={prefs.digest} onChange={() => toggle('digest')} />

      <div className="p-5 space-y-2.5">
        <button type="button" className="m-btn-secondary" onClick={() => navigate('/m/ngo/impact')}>
          <BarChart2 size={16} />
          Intake impact
        </button>
        <button type="button" className="m-btn-secondary" onClick={() => navigate('/m')}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );
}
