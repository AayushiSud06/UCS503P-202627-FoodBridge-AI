import type { DonationStatus } from '../types';

interface StatusBadgeProps {
  status: DonationStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<DonationStatus, { label: string; classes: string; dot: string }> = {
  AVAILABLE: {
    label: 'Available',
    classes: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  MATCHED: {
    label: 'Matched',
    classes: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
  },
  ACCEPTED: {
    label: 'Accepted',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  VOLUNTEER_ASSIGNED: {
    label: 'Volunteer Assigned',
    classes: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
  },
  PICKED_UP: {
    label: 'Picked Up',
    classes: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
  },
  DELIVERED: {
    label: 'Delivered',
    classes: 'bg-teal-50 text-teal-700 border-teal-200',
    dot: 'bg-teal-500',
  },
  COMPLETED: {
    label: 'Completed',
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    classes: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-400',
  },
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${sizeClasses} ${config.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
