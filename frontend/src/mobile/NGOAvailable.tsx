import { useState } from 'react';
import { ArrowRight, Check, Clock, MapPin, Package, Sparkles, X } from 'lucide-react';
import { useDonations, useApp, useMyRecipient } from '../context/AppContext';
import { useCurrentUser } from '../context/AuthContext';
import { useAction, useMatchAnalysis } from '../lib/hooks';
import { deadlineStatus, formatClock, URGENCY_STYLES, byUrgency } from '../lib/time';
import type { Donation } from '../types';
import { MEmpty, MSegmented, MMeter } from './parts';

const SORTS = ['Best match', 'Nearest', 'Closing soon'] as const;

export default function NGOAvailable() {
  const donations = useDonations();
  const { updateDonationStatus } = useApp();
  const user = useCurrentUser();
  const myRecipient = useMyRecipient();
  const { run, isBusy } = useAction();
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Best match');
  const [openId, setOpenId] = useState<string | null>(null);

  const available = donations
    .filter(d => d.status === 'AVAILABLE' || d.status === 'MATCHED')
    .sort((a, b) => {
      if (sort === 'Nearest') return (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
      if (sort === 'Closing soon') return byUrgency(a.pickupDeadline, b.pickupDeadline);
      return (b.matchScore ?? 0) - (a.matchScore ?? 0);
    });

  const selected = donations.find(d => d.id === openId) ?? null;
  // Scored by the server, against this kitchen rather than a stand-in.
  const { analysis } = useMatchAnalysis(openId, user.role === 'ngo' ? user.entityId : undefined);

  const awaitingVerification = myRecipient !== null && myRecipient.isVerified === false;

  const accept = async (d: Donation) => {
    const accepted = await run(
      d.id,
      () => updateDonationStatus(d.id, 'ACCEPTED', { recipientId: user.entityId }),
      {
        success: { message: 'Accepted', subtitle: 'A courier can now claim the pickup.' },
        errorTitle: 'Could not accept this donation',
      },
    );
    if (accepted) setOpenId(null);
  };

  return (
    <>
      <MSegmented options={SORTS} value={sort} onChange={setSort} />

      {available.length === 0 ? (
        <MEmpty
          icon={Package}
          title="Nothing available"
          hint="No surplus is listed near you right now. New donations appear here the moment they are posted."
        />
      ) : (
        available.map(d => {
          const deadline = deadlineStatus(d.pickupDeadline);
          const urgency = URGENCY_STYLES[deadline.urgency];
          const score = d.matchScore ?? 0;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setOpenId(d.id)}
              className="w-full text-left flex gap-4 px-5 py-4 bg-white border-b border-gray-100 active:bg-gray-50"
            >
              <span className="shrink-0 text-center">
                <span
                  className={`block font-display font-semibold text-3xl leading-none ${
                    score >= 90 ? 'text-emerald-700' : 'text-gray-400'
                  }`}
                >
                  {d.matchScore ?? '–'}
                </span>
                <span className="block mt-1 text-[10px] font-semibold tracking-wider text-gray-400">
                  MATCH
                </span>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-display font-semibold text-gray-900 leading-snug truncate">
                  {d.foodName}
                </span>
                <span className="block mt-0.5 text-xs text-gray-500 truncate">
                  {d.donorOrganization}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Package size={12} />
                    {d.quantity} {d.unit}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} />
                    {d.distanceKm ?? '–'} km
                  </span>
                  <span className={`inline-flex items-center gap-1 font-medium ${urgency.text}`}>
                    <Clock size={12} />
                    {deadline.label}
                  </span>
                </span>
              </span>
            </button>
          );
        })
      )}

      <div className="h-4" />

      {selected && (
        <>
          <button
            type="button"
            className="m-backdrop"
            onClick={() => setOpenId(null)}
            aria-label="Close"
          />
          <div className="m-sheet" role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 bg-white border-b border-gray-200">
              <div className="min-w-0">
                <span className="m-chip bg-emerald-50 text-emerald-700">
                  <Sparkles size={11} />
                  Rule-based match
                </span>
                <p className="mt-2 font-display font-semibold text-lg text-gray-900 leading-snug">
                  {selected.quantity} {selected.unit} · {selected.foodName}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {selected.donorOrganization} · {selected.distanceKm ?? '–'} km · by{' '}
                  {formatClock(selected.pickupDeadline)}
                </p>
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
              {analysis ? (
                <>
                  <div className="py-2 bg-white border-b border-gray-100">
                    <MMeter label="Overall suitability" score={analysis.overallScore} />
                    <MMeter label="Distance & logistics" score={analysis.distanceScore} />
                    <MMeter label="Quantity fit" score={analysis.quantityScore} />
                    <MMeter label="Your capacity" score={analysis.capacityScore} />
                    <MMeter label="Pickup window" score={analysis.pickupAvailabilityScore} />
                  </div>

                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      How this donation scores for you
                    </p>
                    <ul className="mt-2.5 space-y-2">
                      {analysis.reasons.map(r => (
                        <li key={r} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                          <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                          {r}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-xs text-gray-400 leading-relaxed">
                      Scores are computed on the server from a fixed weighted formula. Accepting is
                      always your decision — nothing is assigned automatically.
                    </p>
                  </div>
                </>
              ) : (
                <p className="px-5 py-8 text-sm text-gray-500 leading-relaxed">
                  Scoring this donation…
                </p>
              )}
            </div>

            <div className="m-actions">
              {awaitingVerification && (
                <p className="text-xs text-amber-700 leading-relaxed">
                  {myRecipient?.name} is awaiting verification by an administrator and cannot
                  accept donations yet.
                </p>
              )}
              <button
                type="button"
                className="m-btn-primary disabled:opacity-60"
                disabled={isBusy || awaitingVerification}
                onClick={() => accept(selected)}
              >
                {isBusy
                  ? 'Accepting…'
                  : `Accept ${selected.quantity} ${selected.unit.toLowerCase()}`}
                {!isBusy && <ArrowRight size={17} />}
              </button>
              <button type="button" className="m-btn-secondary" onClick={() => setOpenId(null)}>
                Not this time
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
