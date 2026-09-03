import { Route, Utensils } from 'lucide-react';
import { useDonations, useMyVolunteer } from '../context/AppContext';
import { useCurrentUser } from '../context/AuthContext';
import { volunteerImpact } from '../lib/impact';
import { MHero, MSection, MDetail, MShare } from './parts';

export default function VolunteerImpact() {
  const user = useCurrentUser();
  const me = useMyVolunteer();
  const impact = volunteerImpact(useDonations(), user.entityId ?? '', me);

  return (
    <>
      <MHero
        label="Quantity delivered"
        value={impact.deliveredMeals}
        sub={`Across ${impact.runs} completed run${impact.runs === 1 ? '' : 's'} for FoodLink.`}
      />

      <MSection title="Your record" />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Utensils size={14} className="text-emerald-600" /> Runs completed
          </span>
        }
        value={impact.runs}
      />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Route size={14} className="text-emerald-600" /> Straight-line distance
          </span>
        }
        value={`${impact.distanceKm.toFixed(1)} km`}
      />

      <MSection title="Kitchens you delivered to" />
      {impact.drops.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500 bg-white border-b border-gray-100">
          No completed run yet. Claim a pickup and this record starts.
        </p>
      ) : (
        impact.drops.map(drop => (
          <MShare key={drop.label} label={drop.label} value={drop.meals} percent={drop.percent} />
        ))
      )}

      <div className="p-5">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="font-display font-semibold text-emerald-950">Why the last mile matters</p>
          <p className="mt-1 text-sm text-emerald-800 leading-relaxed">
            A match only becomes a meal when someone moves the food. Your {impact.runs} run
            {impact.runs === 1 ? '' : 's'} are the step that carried {impact.deliveredMeals} meals
            from a donor’s door to a kitchen’s.
          </p>
        </div>
      </div>
    </>
  );
}
