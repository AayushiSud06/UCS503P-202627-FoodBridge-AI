import { MapPin, ShieldCheck } from 'lucide-react';
import { MOCK_RECIPIENTS } from '../data/mockData';
import { useDonations } from '../context/AppContext';
import { MSection } from './parts';

export default function AdminOrgs() {
  const donations = useDonations();

  const donorOrgs = [...new Set(donations.map(d => d.donorOrganization))].map(name => ({
    name,
    listings: donations.filter(d => d.donorOrganization === name).length,
    meals: donations
      .filter(d => d.donorOrganization === name)
      .reduce((s, d) => s + d.quantity, 0),
  }));

  return (
    <>
      <MSection title={`Recipient organisations (${MOCK_RECIPIENTS.length})`} />
      {MOCK_RECIPIENTS.map(r => (
        <article key={r.id} className="px-5 py-4 bg-white border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display font-semibold text-gray-900 leading-snug truncate">
                {r.name}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 truncate">{r.type}</p>
            </div>
            <span className="m-chip bg-emerald-50 text-emerald-700 shrink-0">
              <ShieldCheck size={11} />
              {r.reliabilityScore}%
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} />
              {r.distanceKm} km
            </span>
            <span>{r.capacity} meal capacity</span>
            <span>{r.acceptedDonations} accepted</span>
          </div>
        </article>
      ))}

      <MSection title={`Donor organisations (${donorOrgs.length})`} />
      {donorOrgs.map(o => (
        <article key={o.name} className="px-5 py-4 bg-white border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium text-gray-900 truncate min-w-0">{o.name}</p>
            <span className="text-sm font-semibold text-emerald-700 shrink-0">{o.meals}</span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {o.listings} listing{o.listings === 1 ? '' : 's'} · {o.meals} meals contributed
          </p>
        </article>
      ))}
      <div className="h-4" />
    </>
  );
}
