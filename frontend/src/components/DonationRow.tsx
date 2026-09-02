import { Link } from 'react-router-dom';
import { ChevronRight, MapPin, Package } from 'lucide-react';
import type { Donation } from '../types';
import StatusBadge from './StatusBadge';
import { deadlineStatus, formatClock, URGENCY_STYLES } from '../lib/time';

interface DonationRowProps {
  donation: Donation;
  to: string;
  /** Show which organisation the food is going to (donor/admin views). */
  showRecipient?: boolean;
  /** Show who listed the food (recipient/volunteer views). */
  showDonor?: boolean;
  /** Surface the match score — the number a recipient actually decides on. */
  showMatch?: boolean;
}

const CATEGORY_EMOJI: Record<string, string> = {
  'Vegetarian': '🥗',
  'Non-Vegetarian': '🍗',
  'Bakery': '🥖',
  'Fruits & Vegetables': '🍎',
  'Packaged Food': '📦',
  'Other': '🍽️',
};

/** Once food is collected the pickup clock is irrelevant — don't show pressure. */
const CLOCK_STOPPED = ['PICKED_UP', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

export default function DonationRow({
  donation, to, showRecipient = false, showDonor = false, showMatch = false,
}: DonationRowProps) {
  const settled = CLOCK_STOPPED.includes(donation.status);
  const { label, urgency } = deadlineStatus(donation.pickupDeadline);
  const styles = URGENCY_STYLES[urgency];

  return (
    <Link
      to={to}
      className="group relative flex items-center gap-4 rounded-2xl border border-gray-200 bg-white pl-5 pr-4 py-4 transition-all hover:border-gray-300 hover:shadow-sm"
    >
      {/* Urgency rail */}
      <span
        className={`absolute left-0 top-4 bottom-4 w-1 rounded-full ${settled ? 'bg-gray-200' : styles.rail}`}
        aria-hidden="true"
      />

      <span className="text-2xl shrink-0" aria-hidden="true">
        {CATEGORY_EMOJI[donation.category] ?? '🍽️'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="font-display text-base font-semibold text-gray-900 truncate">
            {donation.foodName}
          </h3>
          <span className="text-sm text-gray-400">
            {donation.quantity} {donation.unit}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-gray-500">
          {showDonor && <span className="truncate">{donation.donorOrganization}</span>}
          {showRecipient && donation.recipientName && (
            <span className="truncate">→ {donation.recipientName}</span>
          )}
          {showRecipient && !donation.recipientName && !settled && (
            <span className="italic text-gray-400">Awaiting a recipient</span>
          )}
          {donation.distanceKm !== undefined && (
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {donation.distanceKm} km
            </span>
          )}
          {donation.volunteerName && (
            <span className="flex items-center gap-1">
              <Package size={11} /> {donation.volunteerName}
            </span>
          )}
        </div>
      </div>

      {/* `showMatch` is an NGO-side affordance, so it reports the reader's own
          score rather than the frozen platform-wide top match. */}
      {showMatch && donation.viewerMatch && (
        <div className="hidden md:block text-right shrink-0">
          <p
            className={`font-display text-lg font-semibold ${
              donation.viewerMatch.overallScore >= 90 ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {donation.viewerMatch.overallScore}%
          </p>
          <p className="text-[11px] text-gray-400">your match</p>
        </div>
      )}

      {/* Time pressure — the thing that actually decides what you do next */}
      <div className="hidden sm:block text-right shrink-0">
        {settled ? (
          <span className="text-xs text-gray-400">{formatClock(donation.pickupDeadline)}</span>
        ) : (
          <>
            <p className={`text-sm font-semibold ${styles.text}`}>{label}</p>
            <p className="text-xs text-gray-400">by {formatClock(donation.pickupDeadline)}</p>
          </>
        )}
      </div>

      <div className="shrink-0">
        <StatusBadge status={donation.status} size="sm" />
      </div>

      <ChevronRight
        size={16}
        className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500"
      />
    </Link>
  );
}
