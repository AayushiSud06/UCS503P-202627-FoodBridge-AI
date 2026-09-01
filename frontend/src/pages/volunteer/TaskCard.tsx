import { MapPin, Clock, Package, Building2, Navigation, CheckCircle } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import MapPreview from '../../components/MapPreview';
import { useApp } from '../../context/AppContext';
import { useAction } from '../../lib/hooks';
import { formatClock } from '../../lib/time';
import { useState } from 'react';
import type { Donation } from '../../types';

interface TaskCardProps {
  donation: Donation;
}

export default function TaskCard({ donation }: TaskCardProps) {
  const { updateDonationStatus } = useApp();
  const { run, isBusy } = useAction();
  const [expanded, setExpanded] = useState(false);
  const loading = isBusy;

  // The courier claiming a pickup is identified by their token, so the server
  // resolves which volunteer profile this is — and refuses if another courier
  // already claimed the run.
  const handleAcceptPickup = () =>
    run(donation.id, () => updateDonationStatus(donation.id, 'VOLUNTEER_ASSIGNED'), {
      success: {
        message: 'Pickup accepted',
        subtitle: 'Head to the donor location to collect the food.',
      },
      errorTitle: 'Could not claim this pickup',
    });

  const handleMarkPickedUp = () =>
    run(donation.id, () => updateDonationStatus(donation.id, 'PICKED_UP'), {
      success: {
        message: 'Marked as picked up',
        subtitle: `Now deliver to ${donation.recipientName ?? 'the recipient'}.`,
      },
      errorTitle: 'Could not mark this collected',
    });

  const handleMarkDelivered = () =>
    run(donation.id, () => updateDonationStatus(donation.id, 'DELIVERED'), {
      success: {
        message: 'Delivered',
        subtitle: `${donation.quantity} ${donation.unit} of ${donation.foodName} handed over. The kitchen confirms from here.`,
      },
      errorTitle: 'Could not mark this delivered',
    });

  const getActionButton = () => {
    if (loading) {
      return (
        <button disabled className="btn-primary opacity-60">
          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          Processing…
        </button>
      );
    }
    switch (donation.status) {
      case 'ACCEPTED':
        return (
          <button id={`btn-accept-pickup-${donation.id}`} onClick={handleAcceptPickup} className="btn-primary">
            <CheckCircle size={16} /> Accept Pickup
          </button>
        );
      case 'VOLUNTEER_ASSIGNED':
        return (
          <button id={`btn-picked-up-${donation.id}`} onClick={handleMarkPickedUp} className="btn-primary">
            <Package size={16} /> Mark Picked Up
          </button>
        );
      case 'PICKED_UP':
        return (
          <button id={`btn-delivered-${donation.id}`} onClick={handleMarkDelivered} className="btn-primary bg-teal-600 hover:bg-teal-700">
            <Navigation size={16} /> Mark Delivered
          </button>
        );
      case 'DELIVERED':
      case 'COMPLETED':
        return (
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
            <CheckCircle size={18} /> Delivery Completed
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pickup #{donation.id.replace('don-', '')}</span>
            <StatusBadge status={donation.status} size="sm" />
          </div>
          <h3 className="font-semibold text-gray-900">{donation.quantity} {donation.unit} of {donation.foodName}</h3>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium shrink-0"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      </div>

      {/* Route preview */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-3 items-center gap-2 text-sm">
          <div className="text-center">
            <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-1">
              <Building2 size={16} className="text-emerald-600" />
            </div>
            <p className="text-xs font-medium text-gray-500">DONOR</p>
            <p className="text-xs font-bold text-gray-800 truncate">{donation.donorOrganization}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 font-medium">
              {donation.distanceKm ? `${donation.distanceKm} km` : '~2 km'}
            </p>
            <div className="h-px bg-emerald-300 border border-dashed border-emerald-400 my-1" />
            <p className="text-xs text-gray-400">via you</p>
          </div>
          <div className="text-center">
            <div className="w-8 h-8 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-1">
              <MapPin size={16} className="text-rose-500" />
            </div>
            <p className="text-xs font-medium text-gray-500">RECIPIENT</p>
            <p className="text-xs font-bold text-gray-800 truncate">{donation.recipientName ?? 'TBD'}</p>
          </div>
        </div>
      </div>

      {/* Details row */}
      <div className="px-5 pb-4 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Clock size={12} /> Pickup by {formatClock(donation.pickupDeadline)}</span>
        <span className="flex items-center gap-1"><MapPin size={12} /> {donation.location}</span>
      </div>

      {/* Expanded map */}
      {expanded && (
        <div className="px-5 pb-4">
          <MapPreview
            pickupLocation={donation.location}
            dropoffLocation={donation.recipientName ?? 'Recipient'}
            distanceKm={donation.distanceKm ?? 2.4}
            volunteerLocation="Your current location"
          />
        </div>
      )}

      {/* Action */}
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-gray-400">
          {donation.status === 'ACCEPTED' && 'Accept this task to get directions.'}
          {donation.status === 'VOLUNTEER_ASSIGNED' && 'Proceed to pickup location.'}
          {donation.status === 'PICKED_UP' && 'On the way to ' + (donation.recipientName ?? 'recipient') + '.'}
        </p>
        {getActionButton()}
      </div>
    </div>
  );
}
