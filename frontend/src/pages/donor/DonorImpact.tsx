import { Package, CheckCircle, Building2, Truck } from 'lucide-react';
import ImpactCard from '../../components/ImpactCard';
import { useDonations } from '../../context/AppContext';
import { useCurrentUser } from '../../context/AuthContext';
import { donorImpact } from '../../lib/impact';

export default function DonorImpact() {
  const user = useCurrentUser();
  const impact = donorImpact(useDonations(), user.id);
  const who = user.organization ?? user.name;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Redistribution Record</h1>
        <p className="text-gray-500 mt-1">
          Counted from every donation <strong>{who}</strong> has listed on FoodLink, and from the
          receipts the recipient organisations confirmed.
        </p>
      </div>

      {/* Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ImpactCard
          title="Quantity Listed"
          value={impact.listedMeals}
          unit="Meals"
          subtitle={`Across ${impact.listedCount} listing${impact.listedCount === 1 ? '' : 's'}, in the units you posted them.`}
          icon={Package}
          color="emerald"
        />
        <ImpactCard
          title="Quantity Delivered"
          value={impact.deliveredMeals}
          unit="Meals"
          subtitle="Confirmed received by the recipient organisation."
          icon={CheckCircle}
          color="teal"
        />
        <ImpactCard
          title="Listings Completed"
          value={impact.deliveredCount}
          unit={`of ${impact.listedCount}`}
          subtitle="Donations that reached a kitchen and were signed for."
          icon={Truck}
          color="blue"
        />
        <ImpactCard
          title="Kitchens Reached"
          value={impact.kitchens.length}
          unit={impact.kitchens.length === 1 ? 'Organisation' : 'Organisations'}
          subtitle="Distinct organisations that have confirmed receipt from you."
          icon={Building2}
          color="rose"
        />
      </div>

      {/* Where the surplus actually went */}
      <div className="card p-6">
        <h2 className="section-title mb-1">Where Your Surplus Went</h2>
        <p className="text-xs text-gray-500 mb-4">
          Share of delivered quantity by receiving organisation.
        </p>
        {impact.kitchens.length === 0 ? (
          <p className="text-sm text-gray-500">
            No donation of yours has been confirmed as received yet. This fills in as
            organisations complete their collections.
          </p>
        ) : (
          <div className="space-y-3">
            {impact.kitchens.map(kitchen => (
              <div key={kitchen.label}>
                <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                  <span className="truncate pr-3">{kitchen.label}</span>
                  <span className="shrink-0">
                    {kitchen.meals} · {kitchen.percent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${kitchen.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Breakdown by Food Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="section-title mb-1">Listings by Food Category</h2>
          <p className="text-xs text-gray-500 mb-4">
            Share of listed quantity, from the category on each donation.
          </p>
          {impact.categories.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nothing listed yet — post a donation and this breakdown appears.
            </p>
          ) : (
            <div className="space-y-3">
              {impact.categories.map(category => (
                <div key={category.label}>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span>{category.label}</span>
                    <span>{category.percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${category.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6 bg-gradient-to-br from-emerald-900 to-teal-900 text-white">
          <h2 className="text-lg font-bold mb-2">UN Sustainable Development Goals</h2>
          <p className="text-xs text-emerald-200 mb-4 leading-relaxed">
            Redistributing edible surplus rather than discarding it is the activity UN SDG
            Target 12.3 (halving food waste by 2030) and SDG 2 (Zero Hunger) describe. FoodLink
            does not certify or audit against either goal — the alignment is the point of the
            work, not a rating of it.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white/10 rounded-xl border border-white/10">
              <span className="text-2xl font-extrabold text-emerald-400">SDG 2</span>
              <p className="text-xs text-white font-medium mt-1">Zero Hunger</p>
              <p className="text-[11px] text-emerald-200 mt-0.5">Surplus redistributed to vulnerable communities.</p>
            </div>
            <div className="p-3 bg-white/10 rounded-xl border border-white/10">
              <span className="text-2xl font-extrabold text-teal-300">SDG 12</span>
              <p className="text-xs text-white font-medium mt-1">Responsible Consumption</p>
              <p className="text-[11px] text-emerald-200 mt-0.5">Minimizing institutional kitchen discard.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
