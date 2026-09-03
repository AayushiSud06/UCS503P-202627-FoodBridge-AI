import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Truck } from 'lucide-react';
import { useDonations, useMyVolunteer } from '../context/AppContext';
import { deadlineStatus, URGENCY_STYLES } from '../lib/time';
import { useCurrentUser } from '../context/AuthContext';
import { MHero, MStatGrid, MSection, MEmpty } from './parts';
import StatusBadge from '../components/StatusBadge';
import { volunteerImpact } from '../lib/impact';

const ACTIVE = ['VOLUNTEER_ASSIGNED', 'PICKED_UP'];

export default function VolunteerHome() {
  const navigate = useNavigate();
  const donations = useDonations();
  const user = useCurrentUser();

  const me = useMyVolunteer();
  const mine = donations.filter(d => d.volunteerId === user.entityId);
  const active = mine.filter(d => ACTIVE.includes(d.status));
  const unclaimed = donations.filter(d => d.status === 'ACCEPTED' && !d.volunteerId);
  // The same figures the Impact screen shows, from the same place: this strip
  // and that page answer the same questions about the same courier.
  const impact = volunteerImpact(donations, user.entityId ?? '', me);

  const current = active[0];

  return (
    <>
      <MHero
        label="Deliveries completed"
        value={impact.runs}
        sub={
          current
            ? 'You have one pickup in progress. Finish it before claiming another.'
            : `${unclaimed.length} pickup${unclaimed.length === 1 ? '' : 's'} waiting to be claimed.`
        }
      />

      <MStatGrid
        items={[
          { label: 'Active', value: active.length },
          { label: 'Unclaimed', value: unclaimed.length },
          { label: 'Meals moved', value: impact.deliveredMeals },
          { label: 'Distance', value: `${impact.distanceKm.toFixed(1)} km` },
        ]}
      />

      <MSection
        title={current ? 'Your active pickup' : 'Available pickups'}
        action={
          <button
            type="button"
            onClick={() => navigate('/m/volunteer/tasks')}
            className="text-xs font-medium text-emerald-700"
          >
            All tasks
          </button>
        }
      />

      {current ? (
        <div className="mx-5 mb-2 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display font-semibold text-gray-900 leading-snug">
                {current.quantity} {current.unit} · {current.foodName}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 truncate">#{current.id}</p>
            </div>
            <StatusBadge status={current.status} size="sm" />
          </div>

          <div className="mt-3 space-y-2 text-sm">
            <p className="flex items-start gap-2 text-gray-700">
              <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-wider text-gray-400">
                  Collect
                </span>
                {current.location}
              </span>
            </p>
            <p className="flex items-start gap-2 text-gray-700">
              <MapPin size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-wider text-gray-400">
                  Deliver
                </span>
                {current.recipientName ?? 'To be assigned'}
              </span>
            </p>
          </div>

          {current.status === 'VOLUNTEER_ASSIGNED' && (
            <p className={`mt-3 text-xs font-medium ${URGENCY_STYLES[deadlineStatus(current.pickupDeadline).urgency].text}`}>
              {deadlineStatus(current.pickupDeadline).label} to collect
            </p>
          )}

          <button
            type="button"
            className="m-btn-primary mt-4"
            onClick={() => navigate('/m/volunteer/tasks')}
          >
            Open task
            <ArrowRight size={16} />
          </button>
        </div>
      ) : unclaimed.length === 0 ? (
        <MEmpty
          icon={Truck}
          title="All caught up"
          hint="New pickups appear the moment a kitchen accepts a donation."
        />
      ) : (
        unclaimed.slice(0, 3).map(d => (
          <button
            key={d.id}
            type="button"
            onClick={() => navigate('/m/volunteer/tasks')}
            className="w-full text-left px-5 py-3.5 bg-white border-b border-gray-100 active:bg-gray-50"
          >
            <p className="font-medium text-gray-900 truncate">
              {d.quantity} {d.unit} · {d.foodName}
            </p>
            <p className="mt-0.5 text-xs text-gray-500 truncate">
              {d.donorOrganization} → {d.recipientName ?? 'kitchen'} · {d.distanceKm ?? '–'} km
            </p>
          </button>
        ))
      )}
    </>
  );
}
