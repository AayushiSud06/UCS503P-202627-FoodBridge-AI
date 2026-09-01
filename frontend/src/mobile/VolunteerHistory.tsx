import { History } from 'lucide-react';
import { useDonations } from '../context/AppContext';
import { useCurrentUser } from '../context/AuthContext';
import { MEmpty, MSection } from './parts';
import StatusBadge from '../components/StatusBadge';

export default function VolunteerHistory() {
  const user = useCurrentUser();
  const past = useDonations()
    .filter(d => d.volunteerId === user.entityId && ['DELIVERED', 'COMPLETED'].includes(d.status))
    .sort((a, b) => (b.deliveredAt ?? '').localeCompare(a.deliveredAt ?? ''));

  const day = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '—';

  return (
    <>
      {past.length === 0 ? (
        <MEmpty
          icon={History}
          title="No completed runs yet"
          hint="Every delivery you finish is recorded here with its timestamps."
        />
      ) : (
        <>
          <MSection title={`${past.length} completed run${past.length === 1 ? '' : 's'}`} />
          {past.map(d => (
            <article key={d.id} className="px-5 py-4 bg-white border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-gray-900 leading-snug truncate">
                    {d.quantity} {d.unit} · {d.foodName}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 truncate">
                    {d.donorOrganization} → {d.recipientName ?? 'kitchen'}
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{day(d.deliveredAt)}</span>
              </div>
              <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                <StatusBadge status={d.status} size="sm" />
                <span className="text-xs text-gray-500">{d.distanceKm ?? '–'} km</span>
              </div>
            </article>
          ))}
        </>
      )}
      <div className="h-4" />
    </>
  );
}
