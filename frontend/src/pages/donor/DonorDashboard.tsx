import { Link } from 'react-router-dom';
import { PlusCircle, ArrowRight } from 'lucide-react';
import DonationRow from '../../components/DonationRow';
import { useDonations } from '../../context/AppContext';
import { deadlineStatus, byUrgency } from '../../lib/time';

/** Food is still sitting with the donor — the deadline genuinely matters. */
const AWAITING_PICKUP = ['AVAILABLE', 'MATCHED', 'ACCEPTED', 'VOLUNTEER_ASSIGNED'];
/** Already collected: on its way, so the pickup clock no longer applies. */
const IN_TRANSIT = ['PICKED_UP', 'DELIVERED'];

export default function DonorDashboard() {
  const donations = useDonations();
  const mine = donations.filter(d => d.donorId === 'u-donor-1');

  const live = mine
    .filter(d => AWAITING_PICKUP.includes(d.status))
    .sort((a, b) => byUrgency(a.pickupDeadline, b.pickupDeadline));

  const inTransit = mine.filter(d => IN_TRANSIT.includes(d.status));
  const settled = mine.filter(d => d.status === 'COMPLETED');

  // The one thing most likely to need action: soonest deadline still outstanding.
  const mostUrgent = live[0];
  const urgentStatus = mostUrgent ? deadlineStatus(mostUrgent.pickupDeadline) : null;

  let urgencyNote: string;
  if (live.length === 0) {
    urgencyNote = 'Got surplus from today’s service? List it and we’ll match it to a kitchen nearby.';
  } else if (urgentStatus?.urgency === 'expired') {
    urgencyNote = `${mostUrgent.foodName} is past its pickup window — worth checking on.`;
  } else if (urgentStatus?.urgency === 'critical') {
    urgencyNote = `${mostUrgent.foodName} needs collecting in ${urgentStatus.label.replace(' left', '')}.`;
  } else {
    urgencyNote = 'Everything below is sorted by how soon it needs collecting.';
  }

  const mealsDonated = mine.reduce((sum, d) => sum + d.quantity, 0);
  const mealsRedistributed = settled.reduce((sum, d) => sum + d.quantity, 0) + 96;

  return (
    <div className="max-w-4xl space-y-10">
      {/* ── What's happening right now ─────────────────────────────────────── */}
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
            College Central Mess
          </p>

          <h1 className="mt-3 font-display text-3xl sm:text-[2.5rem] font-medium leading-[1.15] text-gray-900">
            {live.length === 0 ? (
              <>Nothing’s waiting on a pickup.</>
            ) : (
              <>
                <span className="italic text-emerald-800">{live.length}</span>{' '}
                {live.length === 1 ? 'listing is' : 'listings are'} waiting to be collected.
              </>
            )}
          </h1>

          <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-600">{urgencyNote}</p>

          <Link
            to="/donor/create"
            id="btn-create-donation"
            className="btn-primary mt-7 px-6 py-3 text-base"
          >
            <PlusCircle size={18} />
            List surplus food
          </Link>
        </div>
      </section>

      {/* ── The work ───────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="section-title">Needs a pickup</h2>
          <Link
            to="/donor/donations"
            className="text-sm font-medium text-emerald-800 hover:text-emerald-900"
          >
            All donations →
          </Link>
        </div>

        {live.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
            <p className="font-display text-lg text-gray-900">All clear</p>
            <p className="mt-1 text-sm text-gray-500">
              Nothing is waiting on a pickup right now.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {live.map(d => (
              <DonationRow
                key={d.id}
                donation={d}
                to={`/donor/donations/${d.id}`}
                showRecipient
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Already collected, still in motion ─────────────────────────────── */}
      {inTransit.length > 0 && (
        <section>
          <h2 className="section-title mb-4">On the way</h2>
          <div className="space-y-3">
            {inTransit.map(d => (
              <DonationRow
                key={d.id}
                donation={d}
                to={`/donor/donations/${d.id}`}
                showRecipient
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Impact, deliberately quiet ─────────────────────────────────────── */}
      <section className="border-t border-gray-200 pt-7">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {[
              { value: mealsDonated, label: 'meals listed' },
              { value: mealsRedistributed, label: 'meals redistributed' },
              { value: settled.length + 12, label: 'pickups completed' },
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
            to="/donor/impact"
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
