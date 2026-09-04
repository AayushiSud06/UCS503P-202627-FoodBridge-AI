import { AlertTriangle, Check, Clock } from 'lucide-react';
import type { Donation, DonationStatus } from '../types';
import { deadlineStatus, formatClock, URGENCY_STYLES } from '../lib/time';

interface TimelineStep {
  status: DonationStatus;
  label: string;
  description: string;
  timestampKey: keyof Donation;
}

const STEPS: TimelineStep[] = [
  { status: 'AVAILABLE',          label: 'Donation Created',     description: 'Listed on the platform',          timestampKey: 'createdAt' },
  { status: 'MATCHED',            label: 'Matched',              description: 'Suitable recipient identified',    timestampKey: 'matchedAt' },
  { status: 'ACCEPTED',           label: 'Accepted by NGO',      description: 'Recipient confirmed the pickup',   timestampKey: 'acceptedAt' },
  { status: 'VOLUNTEER_ASSIGNED', label: 'Volunteer Assigned',   description: 'Volunteer accepted the task',      timestampKey: 'volunteerAssignedAt' },
  { status: 'PICKED_UP',          label: 'Picked Up',            description: 'Food collected from donor',        timestampKey: 'pickedUpAt' },
  { status: 'DELIVERED',          label: 'Delivered',            description: 'Food delivered to recipient',      timestampKey: 'deliveredAt' },
  { status: 'COMPLETED',          label: 'Completed',            description: 'Donation successfully completed',  timestampKey: 'completedAt' },
];

const STATUS_ORDER: DonationStatus[] = [
  'AVAILABLE', 'MATCHED', 'ACCEPTED', 'VOLUNTEER_ASSIGNED',
  'PICKED_UP', 'DELIVERED', 'COMPLETED',
];

/**
 * The states in which the pickup deadline is still something that can be
 * missed. Once the food is collected the deadline has been answered, so a
 * `PICKED_UP`, `DELIVERED` or `COMPLETED` donation is never overdue however
 * long ago that time was — the same rule as D-38, one field further along:
 * a value that outlives the moment it described is not current state.
 */
const AWAITING_COLLECTION: DonationStatus[] = [
  'AVAILABLE', 'MATCHED', 'ACCEPTED', 'VOLUNTEER_ASSIGNED',
];

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

interface StatusTimelineProps {
  donation: Donation;
}

export default function StatusTimeline({ donation }: StatusTimelineProps) {
  // Cancelled and expired donations left the flow rather than progressing
  // through it, so no step is marked done.
  const isTerminatedEarly = donation.status === 'CANCELLED' || donation.status === 'EXPIRED';
  const currentIdx = isTerminatedEarly ? -1 : STATUS_ORDER.indexOf(donation.status);

  // The deadline has gone and the food is still at the donor's. The row is
  // *not* expired — nothing sweeps it, and this component must not pretend
  // otherwise — so this annotates the state it is in rather than replacing it.
  const isOverdue =
    AWAITING_COLLECTION.includes(donation.status) &&
    deadlineStatus(donation.pickupDeadline).urgency === 'expired';

  return (
    <div className="space-y-0">
      {STEPS.map((step, idx) => {
        const isDone = currentIdx >= idx;
        const isCurrent = currentIdx === idx;
        const isLast = idx === STEPS.length - 1;
        const ts = donation[step.timestampKey] as string | undefined;

        return (
          <div key={step.status} className="flex gap-3">
            {/* Icon + line */}
            <div className="flex flex-col items-center">
              <div className={`
                w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors
                ${isDone
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : isCurrent
                    ? 'bg-white border-emerald-400 text-emerald-500'
                    : 'bg-white border-gray-200 text-gray-300'}
              `}>
                {isDone ? (
                  <Check size={14} />
                ) : (
                  <Clock size={12} />
                )}
              </div>
              {!isLast && (
                <div className={`w-0.5 h-8 ${isDone ? 'bg-emerald-300' : 'bg-gray-100'}`} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-6 ${isLast ? 'pb-0' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-medium ${isDone ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                {isCurrent && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                    Current
                  </span>
                )}
                {isCurrent && isOverdue && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${URGENCY_STYLES.expired.chip}`}
                  >
                    <AlertTriangle size={11} /> Overdue
                  </span>
                )}
              </div>
              <p className={`text-xs ${isDone ? 'text-gray-500' : 'text-gray-300'} mt-0.5`}>
                {step.description}
              </p>
              {isCurrent && isOverdue && (
                <p className={`text-xs font-medium mt-0.5 ${URGENCY_STYLES.expired.text}`}>
                  Pickup deadline passed at {formatClock(donation.pickupDeadline)}
                </p>
              )}
              {isDone && ts && (
                <p className="text-xs text-emerald-600 font-medium mt-0.5">{formatTimestamp(ts)}</p>
              )}
            </div>
          </div>
        );
      })}

      {donation.status === 'CANCELLED' && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium">Donation Cancelled</p>
        </div>
      )}

      {donation.status === 'EXPIRED' && (
        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-700 font-medium">Expired before it was claimed</p>
          <p className="text-xs text-gray-500 mt-0.5">
            The pickup deadline passed with no recipient.
          </p>
        </div>
      )}
    </div>
  );
}
