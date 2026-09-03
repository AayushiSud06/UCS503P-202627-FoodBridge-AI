import { Truck, Navigation, Heart, Building2 } from 'lucide-react';
import ImpactCard from '../../components/ImpactCard';
import { useDonations, useMyVolunteer } from '../../context/AppContext';
import { useCurrentUser } from '../../context/AuthContext';
import { volunteerImpact } from '../../lib/impact';

export default function VolunteerImpact() {
  const user = useCurrentUser();
  const me = useMyVolunteer();
  const impact = volunteerImpact(useDonations(), user.entityId ?? '', me);

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Volunteer Courier Record</h1>
        <p className="text-gray-500 mt-1">
          Personal logistics contributions for <strong>{user.name}</strong>, counted from the runs
          you completed.
        </p>
      </div>

      {/* Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ImpactCard
          title="Quantity Transported"
          value={impact.deliveredMeals}
          unit="Meals"
          subtitle="Carried on completed runs, in the units the donor listed."
          icon={Heart}
          color="rose"
        />
        <ImpactCard
          title="Runs Completed"
          value={impact.runs}
          unit="Trips"
          subtitle={
            impact.runsFromServer
              ? 'Your lifetime total, kept by the server as runs complete.'
              : 'Counted from the runs loaded in this session.'
          }
          icon={Truck}
          color="blue"
        />
        <ImpactCard
          title="Distance Covered"
          value={impact.distanceKm.toFixed(1)}
          unit="km"
          subtitle="Straight-line distance from each donor's pin to the kitchen's. FoodLink does not measure road distance."
          icon={Navigation}
          color="emerald"
        />
      </div>

      {/* Where the runs went */}
      <div className="card p-6">
        <h2 className="section-title mb-1 flex items-center gap-2">
          <Building2 className="text-emerald-600" size={18} />
          Kitchens You Delivered To
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Share of transported quantity by receiving organisation.
        </p>
        {impact.drops.length === 0 ? (
          <p className="text-sm text-gray-500">
            No completed run yet. Claim a pickup from the Tasks board and this record starts.
          </p>
        ) : (
          <div className="space-y-3">
            {impact.drops.map(drop => (
              <div key={drop.label}>
                <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                  <span className="truncate pr-3">{drop.label}</span>
                  <span className="shrink-0">
                    {drop.meals} · {drop.percent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${drop.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
