import { MapPin, Star } from 'lucide-react';
import { useDonations, useVolunteers } from '../context/AppContext';
import type { Volunteer } from '../types';
import { MSection } from './parts';

const IN_FLIGHT = ['VOLUNTEER_ASSIGNED', 'PICKED_UP'];

export default function AdminVolunteers() {
  const volunteers = useVolunteers();
  const donations = useDonations();

  const available = volunteers.filter(v => v.isAvailable);
  const offDuty = volunteers.filter(v => !v.isAvailable);

  // Live load is derivable from what each courier is currently holding.
  const activeTrips = (id: string) =>
    donations.filter(d => d.volunteerId === id && IN_FLIGHT.includes(d.status)).length;

  const row = (v: Volunteer) => (
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
          {v.rating.toFixed(1)}
        </span>
        <span>{v.completedDeliveries} runs</span>
        {activeTrips(v.id) > 0 && (
          <span className="text-clay-700 font-medium">{activeTrips(v.id)} active</span>
        )}
      </div>
    </article>
  );

  return (
    <>
      {volunteers.length === 0 && (
        <p className="px-5 py-8 text-sm text-gray-500">No couriers have registered yet.</p>
      )}

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
