import { MapPin, Star } from 'lucide-react';
import { MOCK_VOLUNTEERS } from '../data/mockData';
import { MSection } from './parts';

export default function AdminVolunteers() {
  const available = MOCK_VOLUNTEERS.filter(v => v.isAvailable);
  const offDuty = MOCK_VOLUNTEERS.filter(v => !v.isAvailable);

  const row = (v: (typeof MOCK_VOLUNTEERS)[number]) => (
    <article key={v.id} className="px-5 py-4 bg-white border-b border-gray-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold text-gray-900 leading-snug truncate">{v.name}</p>
          <p className="mt-0.5 text-xs text-gray-500 truncate">{v.phone}</p>
        </div>
        <span
          className={`m-chip shrink-0 ${
            v.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {v.isAvailable ? 'On duty' : 'Off duty'}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} />
          {v.location}
        </span>
        <span className="inline-flex items-center gap-1">
          <Star size={12} />
          {v.rating}
        </span>
        <span>{v.completedDeliveries} runs</span>
        {v.activeDeliveries > 0 && (
          <span className="text-clay-700 font-medium">{v.activeDeliveries} active</span>
        )}
      </div>
    </article>
  );

  return (
    <>
      <MSection title={`On duty (${available.length})`} />
      {available.map(row)}

      {offDuty.length > 0 && (
        <>
          <MSection title={`Off duty (${offDuty.length})`} />
          {offDuty.map(row)}
        </>
      )}
      <div className="h-4" />
    </>
  );
}
