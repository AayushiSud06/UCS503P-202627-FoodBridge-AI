import { useState } from 'react';
import { CheckSquare, Clock, MapPin, Package, User, Truck, CheckCircle2, ChevronRight } from 'lucide-react';
import { useDonations } from '../../context/AppContext';
import StatusBadge from '../../components/StatusBadge';
import StatusTimeline from '../../components/StatusTimeline';
import MapPreview from '../../components/MapPreview';
import EmptyState from '../../components/EmptyState';
import { Link } from 'react-router-dom';

export default function NGOAcceptedDonations() {
  const donations = useDonations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Accepted donations for this NGO (r-1)
  const acceptedDonations = donations.filter(d =>
    ['ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COMPLETED'].includes(d.status) &&
    (d.recipientId === 'r-1' || !d.recipientId)
  );

  const selected = acceptedDonations.find(d => d.id === selectedId) || acceptedDonations[0];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accepted Deliveries</h1>
          <p className="text-gray-500 mt-1">
            Track incoming food deliveries and monitor volunteer pickup status in real time.
          </p>
        </div>
        <Link to="/ngo/available" className="btn-primary shrink-0">
          + Find More Food
        </Link>
      </div>

      {acceptedDonations.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No accepted donations yet"
          description="Browse available surplus food matches and click 'Accept' to request delivery."
          action={
            <Link to="/ngo/available" className="btn-primary">
              Browse Available Food
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List column */}
          <div className="lg:col-span-1 space-y-3">
            {acceptedDonations.map(d => {
              const isSelected = (selected?.id === d.id);
              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`card p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-md'
                      : 'hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-mono text-gray-400">#{d.id.replace('don-', '')}</span>
                    <StatusBadge status={d.status} size="sm" />
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 mb-1">{d.quantity} {d.unit} of {d.foodName}</h3>
                  <p className="text-xs text-gray-500 mb-2">{d.donorOrganization}</p>

                  <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> by {d.pickupDeadline}
                    </span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                      Details <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed View Panel */}
          {selected && (
            <div className="lg:col-span-2 space-y-6">
              {/* Delivery overview card */}
              <div className="card p-6 space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">
                        Donation {selected.id}
                      </span>
                      <StatusBadge status={selected.status} />
                    </div>
                    <h2 className="text-xl font-extrabold text-gray-900">
                      {selected.quantity} {selected.unit} of {selected.foodName}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">Origin: {selected.donorOrganization}</p>
                  </div>

                  {selected.matchScore && (
                    <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-right">
                      <p className="text-xs text-purple-600 font-semibold">AI Match Score</p>
                      <p className="text-xl font-extrabold text-purple-700">{selected.matchScore}%</p>
                    </div>
                  )}
                </div>

                {/* Logistics details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-gray-50 p-3.5 rounded-xl space-y-1">
                    <span className="text-gray-400 font-medium">DONOR / PICKUP POINT</span>
                    <p className="font-bold text-gray-900 text-sm">{selected.donorOrganization}</p>
                    <p className="text-gray-600 flex items-center gap-1"><MapPin size={12} /> {selected.location}</p>
                  </div>

                  <div className="bg-gray-50 p-3.5 rounded-xl space-y-1">
                    <span className="text-gray-400 font-medium">COURIER DISPATCH</span>
                    <p className="font-bold text-gray-900 text-sm">
                      {selected.volunteerName ? selected.volunteerName : 'Pending Volunteer Assignment'}
                    </p>
                    <p className="text-gray-600 flex items-center gap-1">
                      <Truck size={12} /> {selected.volunteerName ? 'En route on vehicle' : 'Broadcasted to nearby volunteers'}
                    </p>
                  </div>
                </div>

                {/* Map Preview */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Live Corridor Tracking</h3>
                  <MapPreview
                    pickupLocation={selected.location}
                    dropoffLocation="Helping Hands Community Kitchen, Sector 38"
                    distanceKm={selected.distanceKm ?? 1.8}
                    volunteerLocation={selected.volunteerName ? `${selected.volunteerName} (Active)` : 'Awaiting Courier'}
                  />
                </div>

                {/* Status Timeline */}
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Redistribution Timeline</h3>
                  <StatusTimeline donation={selected} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
