import { useState } from 'react';
import { CheckSquare, Clock, MapPin, Package, User, Truck, CheckCircle2, ChevronRight } from 'lucide-react';
import { useApp, useDonations, useMyRecipient } from '../../context/AppContext';
import { useCurrentUser } from '../../context/AuthContext';
import { useAction } from '../../lib/hooks';
import StatusBadge from '../../components/StatusBadge';
import StatusTimeline from '../../components/StatusTimeline';
import MapPreview from '../../components/MapPreview';
import { displayDistanceKm } from '../../lib/geo';
import EmptyState from '../../components/EmptyState';
import { Link } from 'react-router-dom';
import { formatClock } from '../../lib/time';
import type { Donation, DonationStatus } from '../../types';

/**
 * What the courier line reads at each point of the lifecycle.
 *
 * Keyed on the donation's status and never on the mere presence of
 * `volunteerName`: a courier stays attached to the record after the handover,
 * so a populated name says who carried the food, not that somebody is
 * carrying it right now. `courierBound` is whether the lifecycle actually
 * binds a courier to this donation — before the claim the field can still
 * hold a courier who was released back to `ACCEPTED`, and after `COMPLETED`
 * it holds the one who finished the run.
 */
const COURIER_STAGE: Record<DonationStatus, { caption: string; courierBound: boolean }> = {
  AVAILABLE:          { caption: 'Open to nearby couriers',             courierBound: false },
  MATCHED:            { caption: 'Open to nearby couriers',             courierBound: false },
  ACCEPTED:           { caption: 'Open to nearby couriers',             courierBound: false },
  VOLUNTEER_ASSIGNED: { caption: 'Courier assigned, heading to pickup', courierBound: true },
  PICKED_UP:          { caption: 'Collected — on the way to you',      courierBound: true },
  DELIVERED:          { caption: 'Handed over at your kitchen',         courierBound: true },
  COMPLETED:          { caption: 'Delivered — receipt confirmed',      courierBound: true },
  CANCELLED:          { caption: 'Donation cancelled',                  courierBound: false },
  EXPIRED:            { caption: 'Expired before it was claimed',       courierBound: false },
};

/** The courier this donation's status says is carrying it, or carried it. */
function assignedCourierName(donation: Donation): string | undefined {
  if (!COURIER_STAGE[donation.status].courierBound) return undefined;
  return donation.volunteerName ?? 'Assigned courier';
}

export default function NGOAcceptedDonations() {
  const donations = useDonations();
  const user = useCurrentUser();
  const myRecipient = useMyRecipient();
  const { updateDonationStatus } = useApp();
  const { run, isPending } = useAction();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Accepted donations for the organisation this account acts for.
  const acceptedDonations = donations.filter(d =>
    ['ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COMPLETED'].includes(d.status) &&
    d.recipientId === user.entityId
  );

  const selected = acceptedDonations.find(d => d.id === selectedId) || acceptedDonations[0];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accepted Deliveries</h1>
          <p className="text-gray-500 mt-1">
            Follow each accepted donation through pickup and handover, and confirm receipt when it arrives.
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
                      <Clock size={12} /> by {formatClock(d.pickupDeadline)}
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

                  {/* Frozen at acceptance, deliberately: it is the number this
                      organisation actually decided on. Re-scoring it now would
                      slide as the pickup window closes and quietly rewrite the
                      record of the decision. */}
                  {selected.matchScore && (
                    <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-right">
                      <p className="text-xs text-purple-600 font-semibold">Match score at acceptance</p>
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
                      {assignedCourierName(selected) ?? 'Pending Volunteer Assignment'}
                    </p>
                    <p className="text-gray-600 flex items-center gap-1">
                      <Truck size={12} /> {COURIER_STAGE[selected.status].caption}
                    </p>
                  </div>
                </div>

                {/* Map Preview */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Pickup and Drop-off</h3>
                  <MapPreview
                    pickupLocation={selected.location}
                    dropoffLocation={
                      myRecipient
                        ? `${myRecipient.name}, ${myRecipient.location}`
                        : (selected.recipientName ?? 'Your kitchen')
                    }
                    distanceKm={displayDistanceKm(selected) ?? undefined}
                    volunteerLocation={assignedCourierName(selected) ?? 'Courier not yet assigned'}
                  />
                </div>

                {/* Confirming receipt is what closes the loop: it is the last
                    server-stamped event, and every completion metric reads it. */}
                {selected.status === 'DELIVERED' && (
                  <div className="border-t border-gray-100 pt-4 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold text-gray-900">The courier has handed this over.</p>
                      <p className="text-sm text-gray-500">
                        Confirm you received {selected.quantity} {selected.unit} to close the record.
                      </p>
                    </div>
                    <button
                      type="button"
                      id={`btn-confirm-receipt-${selected.id}`}
                      disabled={isPending(selected.id)}
                      onClick={() =>
                        run(selected.id, () => updateDonationStatus(selected.id, 'COMPLETED'), {
                          success: {
                            message: 'Receipt confirmed',
                            subtitle: `${selected.quantity} ${selected.unit} logged against your intake.`,
                          },
                          errorTitle: 'Could not confirm receipt',
                        })
                      }
                      className="btn-primary disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} />
                      {isPending(selected.id) ? 'Confirming…' : 'Confirm receipt'}
                    </button>
                  </div>
                )}

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
