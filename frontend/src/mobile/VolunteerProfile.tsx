import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, LogOut, Star } from 'lucide-react';
import { MOCK_VOLUNTEERS } from '../data/mockData';
import { VOLUNTEER_ID } from './nav';
import { MSection, MDetail, MToggle } from './parts';

const ME = MOCK_VOLUNTEERS.find(v => v.id === VOLUNTEER_ID)!;

export default function VolunteerProfile() {
  const navigate = useNavigate();
  const [available, setAvailable] = useState(ME.isAvailable);
  const [prefs, setPrefs] = useState({ nearby: true, night: false });
  const toggle = (k: keyof typeof prefs) => setPrefs(p => ({ ...p, [k]: !p[k] }));

  return (
    <>
      <section className="flex items-center gap-4 px-5 py-5 bg-white border-b border-gray-200">
        <span className="w-14 h-14 shrink-0 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg font-bold">
          AS
        </span>
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-lg text-gray-900 truncate">{ME.name}</h2>
          <p className="text-sm text-gray-500 truncate">{ME.location}</p>
          <span className="mt-1.5 m-chip bg-emerald-50 text-emerald-700">
            <Star size={12} />
            {ME.rating} · {ME.completedDeliveries} runs
          </span>
        </div>
      </section>

      <MSection title="Availability" />
      <MToggle
        label={available ? 'Accepting pickups' : 'Not accepting pickups'}
        checked={available}
        onChange={() => setAvailable(v => !v)}
      />
      <MToggle label="Only alert me under 3 km" checked={prefs.nearby} onChange={() => toggle('nearby')} />
      <MToggle label="Available after 8 PM" checked={prefs.night} onChange={() => toggle('night')} />

      <MSection title="Details" />
      <MDetail label="Phone" value={ME.phone} />
      <MDetail label="Base location" value={ME.location} />
      <MDetail label="Completed deliveries" value={ME.completedDeliveries} />
      <MDetail label="Active deliveries" value={ME.activeDeliveries} />

      <div className="p-5 space-y-2.5">
        <button
          type="button"
          className="m-btn-secondary"
          onClick={() => navigate('/m/volunteer/impact')}
        >
          <BarChart2 size={16} />
          Courier impact
        </button>
        <button type="button" className="m-btn-secondary" onClick={() => navigate('/m')}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );
}
