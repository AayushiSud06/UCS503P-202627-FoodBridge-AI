import { MapPin, Clock, Package, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Donation } from '../types';
import StatusBadge from './StatusBadge';
import MatchScore from './MatchScore';
import { formatClock } from '../lib/time';

interface DonationCardProps {
  donation: Donation;
  viewAs?: 'donor' | 'ngo' | 'volunteer' | 'admin';
  onAction?: (donation: Donation) => void;
  actionLabel?: string;
  detailPath?: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  'Vegetarian': '🥗',
  'Non-Vegetarian': '🍗',
  'Bakery': '🥖',
  'Fruits & Vegetables': '🍎',
  'Packaged Food': '📦',
  'Other': '🍽️',
};

export default function DonationCard({
  donation, viewAs = 'donor', onAction, actionLabel, detailPath
}: DonationCardProps) {
  const emoji = CATEGORY_EMOJI[donation.category] ?? '🍽️';

  return (
    <div className="card-hover p-4 space-y-3 h-full flex flex-col">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-xl shrink-0">
            {emoji}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{donation.foodName}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{donation.donorOrganization}</p>
          </div>
        </div>
        <StatusBadge status={donation.status} size="sm" />
      </div>

      {/* Details row */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Package size={12} className="text-gray-400" />
          {donation.quantity} {donation.unit}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} className="text-gray-400" />
          Pickup by {formatClock(donation.pickupDeadline)}
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={12} className="text-gray-400" />
          {donation.distanceKm ? `${donation.distanceKm} km` : donation.location.split(',')[0]}
        </span>
      </div>

      {/* NGO match score — this kitchen's own, not the leader's. `matchScore`
          is the top match frozen at posting and belongs to whichever
          organisation won it, so showing it here read as a promise to the
          wrong reader. */}
      {viewAs === 'ngo' && donation.viewerMatch && (
        <div className="flex items-center gap-2">
          <MatchScore score={donation.viewerMatch.overallScore} size="sm" showLabel={false} />
          <div className="text-xs text-gray-500">
            <span className="font-medium text-emerald-700">
              {donation.viewerMatch.overallScore}% match for you
            </span>
            {donation.recipientName && <span> · {donation.recipientName}</span>}
          </div>
        </div>
      )}

      {/* Action row */}
      {(onAction || detailPath) && (
        <div className="flex items-center gap-2 pt-3 mt-auto border-t border-gray-100">
          {onAction && actionLabel && (
            <button
              onClick={() => onAction(donation)}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              {actionLabel}
            </button>
          )}
          {detailPath && (
            <Link
              to={detailPath}
              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              View Details <ExternalLink size={11} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
