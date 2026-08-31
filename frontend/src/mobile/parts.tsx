import type { ReactNode } from 'react';
import { ChevronRight, Clock, MapPin, Package, type LucideIcon } from 'lucide-react';
import type { Donation } from '../types';
import StatusBadge from '../components/StatusBadge';
import { deadlineStatus, URGENCY_STYLES } from '../lib/time';

/**
 * Shared mobile building blocks. These wrap the same primitives the desktop
 * portals use (StatusBadge, deadlineStatus) so the two stay in step: a status
 * colour or urgency threshold is only ever defined once.
 */

export function MSection({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="m-sec">
      <h2 className="m-sec-title">{title}</h2>
      {action}
    </div>
  );
}

export function MEmpty({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
        <Icon size={22} />
      </div>
      <p className="mt-3 font-display font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500 leading-relaxed">{hint}</p>
    </div>
  );
}

/** Focal number at the top of a role's home screen. */
export function MHero({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <section className="px-5 pt-5 pb-6 bg-white border-b border-gray-200">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{label}</p>
      <p className="mt-1.5 font-display font-semibold text-gray-900 text-5xl leading-none tracking-tight">
        {value}
      </p>
      {sub && <p className="mt-2.5 text-sm text-gray-500 leading-relaxed">{sub}</p>}
    </section>
  );
}

export function MStatGrid({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 bg-white border-b border-gray-200">
      {items.map((s, i) => (
        <div
          key={s.label}
          className={`px-5 py-3.5 ${i % 2 === 0 ? 'border-r border-gray-200' : ''} ${
            i < items.length - 2 ? 'border-b border-gray-200' : ''
          }`}
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{s.label}</p>
          <p className="mt-0.5 font-display font-semibold text-2xl text-gray-900">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

export function MDetail({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-100 bg-white">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

export function MMeter({ label, score }: { label: string; score: number }) {
  const tone = score >= 90 ? 'bg-emerald-600' : score >= 75 ? 'bg-amber-400' : 'bg-clay-400';
  return (
    <div className="px-5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{score}%</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

/**
 * One donation in a list. `showDeadline` is suppressed once a donation is
 * already in transit — a picked-up load is a drop-off, not a pickup, so
 * pickup-deadline pressure would be wrong.
 */
export function MDonationRow({
  donation,
  onClick,
  subtitle,
}: {
  donation: Donation;
  onClick?: () => void;
  subtitle?: ReactNode;
}) {
  const stillAwaitingPickup = !['PICKED_UP', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(donation.status);
  const deadline = deadlineStatus(donation.pickupDeadline);
  const urgency = URGENCY_STYLES[deadline.urgency];

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold text-gray-900 leading-snug truncate">
            {donation.foodName}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 truncate">
            {subtitle ?? `${donation.donorOrganization} · #${donation.id}`}
          </p>
        </div>
        {onClick && <ChevronRight size={18} className="text-gray-300 shrink-0 mt-1" />}
      </div>

      <div className="mt-2.5 flex items-center gap-3 flex-wrap text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <Package size={12} />
          {donation.quantity} {donation.unit}
        </span>
        {donation.distanceKm !== undefined && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {donation.distanceKm} km
          </span>
        )}
        {stillAwaitingPickup && (
          <span className={`inline-flex items-center gap-1 font-medium ${urgency.text}`}>
            <Clock size={12} />
            {deadline.label}
          </span>
        )}
      </div>

      <div className="mt-2.5">
        <StatusBadge status={donation.status} size="sm" />
      </div>
    </>
  );

  const className = 'w-full text-left px-5 py-4 border-b border-gray-100 bg-white';

  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} active:bg-gray-50`}>
      {inner}
    </button>
  ) : (
    <article className={className}>{inner}</article>
  );
}

export function MToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="w-full flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-100 bg-white active:bg-gray-50"
    >
      <span className="text-sm text-gray-700 text-left">{label}</span>
      <span
        className={`w-11 h-6 rounded-full p-0.5 flex shrink-0 transition-colors ${
          checked ? 'bg-emerald-700 justify-end' : 'bg-gray-300 justify-start'
        }`}
      >
        <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
      </span>
    </button>
  );
}

/** Horizontal segmented control used for list filters and sorts. */
export function MSegmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex-none flex gap-1.5 px-5 py-3 bg-white border-b border-gray-200 overflow-x-auto">
      {options.map(o => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            value === o
              ? 'bg-emerald-700 text-white'
              : 'bg-gray-100 text-gray-600 active:bg-gray-200'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
