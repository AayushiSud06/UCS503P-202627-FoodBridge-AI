import { CheckCircle, Package, Route } from 'lucide-react';
import { useDonations } from '../context/AppContext';
import { useCurrentUser } from '../context/AuthContext';
import { donorImpact } from '../lib/impact';
import { MHero, MSection, MDetail, MShare } from './parts';

export default function DonorImpact() {
  const user = useCurrentUser();
  const impact = donorImpact(useDonations(), user.id);
  // The tallest column sets the scale; with nothing listed there is no chart
  // to draw rather than a flat row of zeroes pretending to be one.
  const peak = Math.max(...impact.monthly.map(m => m.meals), 0);

  return (
    <>
      <MHero
        label="Quantity listed"
        value={impact.listedMeals}
        sub="Counted from every donation you have listed, in the units you posted them."
      />

      <section className="px-5 py-5 bg-white border-b border-gray-200">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Last six months</p>
        {peak === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            Nothing listed in the last six months.
          </p>
        ) : (
          <>
            <div className="mt-3 flex items-end gap-1.5 h-24">
              {impact.monthly.map((month, i) => (
                <div key={month.label} className="flex-1 flex flex-col justify-end h-full">
                  <div
                    className={`rounded-t-md ${
                      i === impact.monthly.length - 1 ? 'bg-emerald-600' : 'bg-emerald-200'
                    }`}
                    style={{ height: `${Math.round((month.meals / peak) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-gray-400">
              {impact.monthly.map(month => (
                <span key={month.label}>{month.label}</span>
              ))}
            </div>
          </>
        )}
      </section>

      <MSection title="Your record" />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Package size={14} className="text-emerald-600" /> Listings posted
          </span>
        }
        value={impact.listedCount}
      />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <CheckCircle size={14} className="text-emerald-600" /> Delivered and confirmed
          </span>
        }
        value={`${impact.deliveredMeals} (${impact.deliveredCount} listing${
          impact.deliveredCount === 1 ? '' : 's'
        })`}
      />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Route size={14} className="text-emerald-600" /> Straight-line distance
          </span>
        }
        value={`${impact.distanceKm.toFixed(1)} km`}
      />

      <MSection title="Kitchens you supply" />
      {impact.kitchens.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500 bg-white border-b border-gray-100">
          No kitchen has confirmed receiving your surplus yet.
        </p>
      ) : (
        impact.kitchens.map(kitchen => (
          <MShare
            key={kitchen.label}
            label={kitchen.label}
            value={kitchen.meals}
            percent={kitchen.percent}
          />
        ))
      )}

      <div className="p-5">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="font-display font-semibold text-emerald-950">UN Sustainable Development Goals</p>
          <p className="mt-1 text-sm text-emerald-800 leading-relaxed">
            Redistributing edible surplus is the activity Goal 2 (Zero Hunger) and Goal 12
            (Responsible Consumption and Production) describe. FoodLink does not certify or audit
            against either goal.
          </p>
        </div>
      </div>
    </>
  );
}
