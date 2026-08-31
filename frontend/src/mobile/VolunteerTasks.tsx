import { useState } from 'react';
import { ArrowRight, Navigation, Phone, Truck, X } from 'lucide-react';
import { useDonations, useApp } from '../context/AppContext';
import { deadlineStatus, URGENCY_STYLES } from '../lib/time';
import type { Donation, DonationStatus } from '../types';
import StatusBadge from '../components/StatusBadge';
import { VOLUNTEER_ID, VOLUNTEER_NAME } from './nav';
import { MEmpty, MSection } from './parts';

/** The one action available at each point in a courier's run. */
const NEXT: Partial<Record<DonationStatus, { status: DonationStatus; cta: string; hint: string }>> = {
  ACCEPTED: {
    status: 'VOLUNTEER_ASSIGNED',
    cta: 'Claim this pickup',
    hint: 'Claim within 10 minutes or the task returns to the pool.',
  },
  VOLUNTEER_ASSIGNED: {
    status: 'PICKED_UP',
    cta: 'Mark picked up',
    hint: 'Collect from the donor and confirm the load.',
  },
  PICKED_UP: {
    status: 'DELIVERED',
    cta: 'Mark delivered',
    hint: 'On the way to the recipient kitchen.',
  },
};

export default function VolunteerTasks() {
  const donations = useDonations();
  const { updateDonationStatus, showToast } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);

  const tasks = donations.filter(
    d =>
      (d.volunteerId === VOLUNTEER_ID && !['COMPLETED', 'CANCELLED'].includes(d.status)) ||
      (d.status === 'ACCEPTED' && !d.volunteerId)
  );

  const selected = donations.find(d => d.id === openId) ?? null;

  const advance = (task: Donation) => {
    const next = NEXT[task.status];
    if (!next) return;
    const extra =
      next.status === 'VOLUNTEER_ASSIGNED'
        ? { volunteerId: VOLUNTEER_ID, volunteerName: VOLUNTEER_NAME }
        : undefined;
    updateDonationStatus(task.id, next.status, extra);
    showToast('success', next.cta, `#${task.id} · ${task.quantity} ${task.unit}`);
    if (next.status === 'DELIVERED') setOpenId(null);
  };

  const time = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';

  return (
    <>
      {tasks.length === 0 ? (
        <MEmpty
          icon={Truck}
          title="No pickups right now"
          hint="Tasks appear here the moment a kitchen accepts a donation nearby."
        />
      ) : (
        tasks.map(d => {
          const deadline = deadlineStatus(d.pickupDeadline);
          const urgency = URGENCY_STYLES[deadline.urgency];
          const mine = d.volunteerId === VOLUNTEER_ID;
          const awaitingPickup = d.status !== 'PICKED_UP';
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setOpenId(d.id)}
              className="w-full text-left px-5 py-4 bg-white border-b border-gray-100 active:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-gray-900 leading-snug truncate">
                    {d.quantity} {d.unit} · {d.foodName}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 truncate">
                    {d.donorOrganization} → {d.recipientName ?? 'kitchen'}
                  </p>
                </div>
                {mine && (
                  <span className="m-chip bg-emerald-50 text-emerald-700 shrink-0">Yours</span>
                )}
              </div>
              <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                <StatusBadge status={d.status} size="sm" />
                <span className="text-xs text-gray-500">{d.distanceKm ?? '–'} km</span>
                {awaitingPickup && (
                  <span className={`text-xs font-medium ${urgency.text}`}>{deadline.label}</span>
                )}
              </div>
            </button>
          );
        })
      )}

      <div className="h-4" />

      {selected && (
        <>
          <button type="button" className="m-backdrop" onClick={() => setOpenId(null)} aria-label="Close" />
          <div className="m-sheet" role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-3 px-5 py-4 bg-white border-b border-gray-200">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Pickup #{selected.id}
                </p>
                <h2 className="mt-0.5 font-display font-semibold text-lg text-gray-900 leading-snug">
                  {selected.quantity} {selected.unit} · {selected.foodName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                aria-label="Close"
                className="w-9 h-9 shrink-0 rounded-full border border-gray-300 text-gray-500 flex items-center justify-center active:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-4 space-y-3.5 bg-white border-b border-gray-200">
                {([
                  ['A', 'Collect', selected.location, selected.donorOrganization],
                  ['B', 'Deliver', selected.recipientName ?? 'To be assigned', 'Recipient kitchen'],
                ] as const).map(([pin, label, line1, line2], i) => (
                  <div key={pin} className="flex gap-3">
                    <span
                      className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0
                          ? 'bg-gray-900 text-white'
                          : 'border-2 border-emerald-600 text-emerald-700'
                      }`}
                    >
                      {pin}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wider text-gray-400">{label}</p>
                      <p className="text-sm font-medium text-gray-900">{line1}</p>
                      <p className="text-xs text-gray-500">{line2}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 bg-white border-b border-gray-200">
                {([
                  ['Load', `${selected.quantity} ${selected.unit}`, false],
                  ['Deadline', selected.pickupDeadline, true],
                  ['Storage', selected.storageType.split(' ')[0], false],
                ] as const).map(([k, v, hot], i) => (
                  <div key={k} className={`px-4 py-3 ${i < 2 ? 'border-r border-gray-200' : ''}`}>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">{k}</p>
                    <p
                      className={`mt-0.5 font-display font-semibold ${
                        hot ? 'text-clay-700' : 'text-gray-900'
                      }`}
                    >
                      {v}
                    </p>
                  </div>
                ))}
              </div>

              <MSection title="Chain of custody" />
              <div className="bg-white border-y border-gray-100">
                {([
                  ['Listed by donor', selected.createdAt],
                  ['Matched', selected.matchedAt],
                  ['Accepted by kitchen', selected.acceptedAt],
                  ['Courier assigned', selected.volunteerAssignedAt],
                  ['Picked up', selected.pickedUpAt],
                  ['Delivered', selected.deliveredAt],
                ] as [string, string | undefined][]).map(([label, iso]) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-50 last:border-0"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${iso ? 'bg-emerald-600' : 'bg-gray-300'}`}
                    />
                    <span
                      className={`flex-1 text-sm ${iso ? 'text-gray-900 font-medium' : 'text-gray-400'}`}
                    >
                      {label}
                    </span>
                    <span className="text-xs text-gray-400">{time(iso)}</span>
                  </div>
                ))}
              </div>

              {selected.description && (
                <div className="m-5 rounded-2xl bg-gray-100 p-4">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <strong className="font-semibold text-gray-900">Handling note. </strong>
                    {selected.description}
                  </p>
                </div>
              )}
            </div>

            <div className="m-actions">
              <p className="text-xs text-gray-500 leading-relaxed">
                {NEXT[selected.status]?.hint ??
                  `Delivered. ${selected.quantity} ${selected.unit} logged against your record.`}
              </p>
              <div className="flex gap-2.5">
                <button type="button" className="m-btn-icon" aria-label="Call">
                  <Phone size={17} />
                </button>
                <button type="button" className="m-btn-icon" aria-label="Navigate">
                  <Navigation size={17} />
                </button>
                <button
                  type="button"
                  className="m-btn-primary"
                  disabled={!NEXT[selected.status]}
                  onClick={() => advance(selected)}
                >
                  {NEXT[selected.status]?.cta ?? 'Task complete'}
                  {NEXT[selected.status] && <ArrowRight size={17} />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
