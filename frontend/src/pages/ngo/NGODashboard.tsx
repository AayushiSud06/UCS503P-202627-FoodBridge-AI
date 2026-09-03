import { Link } from 'react-router-dom';
import { Package, ArrowRight } from 'lucide-react';
import DonationRow from '../../components/DonationRow';
import { useDonations } from '../../context/AppContext';
import { useCurrentUser } from '../../context/AuthContext';
import { deadlineStatus, byUrgency } from '../../lib/time';
import { displayDistanceKm } from '../../lib/geo';

export default function NGODashboard() {
  const donations = useDonations();
  const user = useCurrentUser();

  const open = donations
    .filter(d => ['AVAILABLE', 'MATCHED'].includes(d.status))
    .sort((a, b) => byUrgency(a.pickupDeadline, b.pickupDeadline));

  const accepted = donations.filter(
    d => ['ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP'].includes(d.status) && d.recipientId === user.entityId
  );
  const completed = donations.filter(d => d.status === 'COMPLETED' && d.recipientId === user.entityId);

  const mealsOnOffer = open.reduce((sum, d) => sum + d.quantity, 0);
  const mealsReceived = completed.reduce((sum, d) => sum + d.quantity, 0);

  // An unclaimed donation has no `distanceKm` — that one is measured against
  // the recipient it is matched to. What it does carry is `viewerMatch`, this
  // kitchen's own straight-line distance, which is the figure this sentence
  // wants; `displayDistanceKm` picks between them.
  const closestKm = open
    .map(displayDistanceKm)
    .filter((km): km is number => km !== null)
    .sort((a, b) => a - b)[0];
  const soonest = open[0];
  const soonestStatus = soonest ? deadlineStatus(soonest.pickupDeadline) : null;

  return (
    <div className="max-w-4xl space-y-10">
      {/* ── What's on offer right now ──────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-[#FBF8F3] px-7 py-8 sm:px-9 sm:py-10">
        <svg
          viewBox="0 0 200 200"
          className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 opacity-50"
          aria-hidden="true"
        >
          <path
            fill="#e3ead3"
            d="M45.3,-58.4C59.5,-49.9,72.4,-37.7,76.9,-22.9C81.5,-8.1,77.7,9.3,69.6,23.7C61.6,38.1,49.3,49.5,35.4,58.6C21.6,67.6,6.1,74.3,-9.9,74.6C-25.9,74.9,-42.4,68.9,-54.6,58C-66.8,47.1,-74.7,31.4,-77.4,14.5C-80.1,-2.3,-77.6,-20.3,-68.7,-34.3C-59.8,-48.3,-44.5,-58.2,-29.4,-65.7C-14.2,-73.1,0.8,-78.1,15.9,-76.1C31,-74.1,45.3,-58.4,45.3,-58.4Z"
            transform="translate(100 100)"
          />
        </svg>

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay-700">
            {user.organization ?? user.name}
          </p>

          <h1 className="mt-3 font-display text-3xl sm:text-[2.5rem] font-medium leading-[1.15] text-gray-900">
            {open.length === 0 ? (
              <>Nothing on offer right now.</>
            ) : (
              <>
                <span className="italic text-emerald-800">{mealsOnOffer}</span> meals are open
                to claim.
              </>
            )}
          </h1>

          <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-600">
            {open.length === 0
              ? 'We’ll flag new donations here the moment a donor lists them nearby.'
              : [
                  closestKm !== undefined
                    ? `Closest is ${closestKm} km away in a straight line`
                    : 'Sorted by how soon each closes',
                  soonestStatus && soonestStatus.urgency !== 'ok'
                    ? `the soonest closes in ${soonestStatus.label.replace(' left', '')}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(', ') + '.'}
          </p>

          <Link to="/ngo/available" className="btn-primary mt-7 px-6 py-3 text-base">
            <Package size={18} />
            Browse available food
          </Link>
        </div>
      </section>

      {/* ── Decide on these ────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="section-title">Open to claim</h2>
          <Link
            to="/ngo/available"
            className="text-sm font-medium text-emerald-800 hover:text-emerald-900"
          >
            View all →
          </Link>
        </div>

        {open.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
            <p className="font-display text-lg text-gray-900">Nothing available</p>
            <p className="mt-1 text-sm text-gray-500">Check back shortly — listings move fast.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {open.map(d => (
              <DonationRow
                key={d.id}
                donation={d}
                to={`/ngo/available/${d.id}`}
                showDonor
                showMatch
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Already yours ──────────────────────────────────────────────────── */}
      {accepted.length > 0 && (
        <section>
          <h2 className="section-title mb-4">Coming to you</h2>
          <div className="space-y-3">
            {accepted.map(d => (
              <DonationRow key={d.id} donation={d} to="/ngo/accepted" showDonor />
            ))}
          </div>
        </section>
      )}

      {/* ── Impact, deliberately quiet ─────────────────────────────────────── */}
      <section className="border-t border-gray-200 pt-7">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {[
              { value: mealsReceived, label: 'meals received' },
              { value: completed.length, label: 'pickups completed' },
              { value: accepted.length, label: 'currently accepted' },
            ].map(stat => (
              <div key={stat.label}>
                <p className="font-display text-2xl font-semibold text-gray-900">
                  {stat.value.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>

          <Link
            to="/ngo/impact"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-emerald-800"
          >
            See your full impact
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
