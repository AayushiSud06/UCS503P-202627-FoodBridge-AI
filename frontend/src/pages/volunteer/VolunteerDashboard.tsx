import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import DonationRow from '../../components/DonationRow';
import { useDonations } from '../../context/AppContext';
import { deadlineStatus, byUrgency, formatClock } from '../../lib/time';
import { useCurrentUser } from '../../context/AuthContext';
import TaskCard from './TaskCard';

export default function VolunteerDashboard() {
  const donations = useDonations();
  const user = useCurrentUser();

  // Tasks assigned to this volunteer (v-1) or newly accepted and unclaimed.
  const myTasks = donations
    .filter(
      d =>
        (d.volunteerId === user.entityId || (d.status === 'ACCEPTED' && !d.volunteerId)) &&
        !['COMPLETED', 'CANCELLED', 'AVAILABLE', 'MATCHED'].includes(d.status)
    )
    .sort((a, b) => byUrgency(a.pickupDeadline, b.pickupDeadline));

  const [nextRun, ...queue] = myTasks;
  const nextStatus = nextRun ? deadlineStatus(nextRun.pickupDeadline) : null;

  const completedTasks = donations.filter(d => d.volunteerId === user.entityId && d.status === 'COMPLETED');
  const mealsMoved = completedTasks.reduce((sum, d) => sum + d.quantity, 0) + 42;

  // Food already collected is a drop-off, not a pickup — the copy has to follow the stage.
  const carrying = nextRun?.status === 'PICKED_UP';
  const dropOff = nextRun?.recipientName ?? 'the recipient';

  let runNote: string;
  if (!nextRun) {
    runNote = 'Nothing assigned right now. New pickups will show up here as donors list food nearby.';
  } else if (carrying) {
    runNote = `You're carrying ${nextRun.quantity} ${nextRun.unit} — drop it with ${dropOff}, ${nextRun.distanceKm ?? '~2'} km away.`;
  } else if (nextStatus?.urgency === 'expired') {
    runNote = `Pickup was due by ${formatClock(nextRun.pickupDeadline)} — go as soon as you can.`;
  } else {
    runNote = `${nextRun.distanceKm ?? '~2'} km away, and the pickup window closes in ${nextStatus?.label.replace(' left', '')}.`;
  }

  return (
    <div className="max-w-3xl space-y-10">
      {/* ── Your next run ──────────────────────────────────────────────────── */}
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
            Aarav · Volunteer courier
          </p>

          <h1 className="mt-3 font-display text-3xl sm:text-[2.5rem] font-medium leading-[1.15] text-gray-900">
            {!nextRun ? (
              <>You’re all caught up.</>
            ) : carrying ? (
              <>
                You’re on the way to{' '}
                <span className="italic text-emerald-800">{dropOff}</span>.
              </>
            ) : (
              <>
                Your next run is{' '}
                <span className="italic text-emerald-800">{nextRun.donorOrganization}</span>.
              </>
            )}
          </h1>

          <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-600">{runNote}</p>
        </div>
      </section>

      {/* ── The one task in front of you ───────────────────────────────────── */}
      {nextRun && (
        <section>
          <h2 className="section-title mb-4">Next run</h2>
          <TaskCard donation={nextRun} />
        </section>
      )}

      {/* ── Everything else, compact ───────────────────────────────────────── */}
      {queue.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="section-title">Also assigned</h2>
            <Link
              to="/volunteer/tasks"
              className="text-sm font-medium text-emerald-800 hover:text-emerald-900"
            >
              All tasks →
            </Link>
          </div>
          <div className="space-y-3">
            {queue.map(d => (
              <DonationRow key={d.id} donation={d} to="/volunteer/tasks" showDonor />
            ))}
          </div>
        </section>
      )}

      {myTasks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
          <p className="font-display text-lg text-gray-900">No active pickups</p>
          <p className="mt-1 text-sm text-gray-500">
            Browse open tasks to pick up your next delivery.
          </p>
          <Link to="/volunteer/tasks" className="btn-primary mt-5">
            Browse tasks
          </Link>
        </div>
      )}

      {/* ── Impact, deliberately quiet ─────────────────────────────────────── */}
      <section className="border-t border-gray-200 pt-7">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {[
              { value: completedTasks.length + 8, label: 'pickups completed' },
              { value: mealsMoved, label: 'meals moved' },
              { value: '12 km', label: 'distance covered' },
            ].map(stat => (
              <div key={stat.label}>
                <p className="font-display text-2xl font-semibold text-gray-900">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>

          <Link
            to="/volunteer/impact"
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
