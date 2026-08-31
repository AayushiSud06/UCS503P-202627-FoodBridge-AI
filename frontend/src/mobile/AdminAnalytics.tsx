import { useDonations, useStats } from '../context/AppContext';
import type { FoodCategory } from '../types';
import { MHero, MSection, MMeter, MDetail } from './parts';

const WEEKS = [
  { label: 'W1', value: 48 },
  { label: 'W2', value: 62 },
  { label: 'W3', value: 41 },
  { label: 'W4', value: 78 },
  { label: 'W5', value: 66 },
  { label: 'W6', value: 100 },
];

export default function AdminAnalytics() {
  const donations = useDonations();
  const stats = useStats();

  const byCategory = new Map<FoodCategory, number>();
  donations.forEach(d => byCategory.set(d.category, (byCategory.get(d.category) ?? 0) + d.quantity));
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const topCategory = categories[0]?.[1] ?? 1;

  const completionRate = stats.totalDonations
    ? Math.round((stats.completedDonations / stats.totalDonations) * 100)
    : 0;
  const avgPerDonation = stats.totalDonations
    ? Math.round(stats.totalMeals / stats.totalDonations)
    : 0;

  return (
    <>
      <MHero
        label="Total meals"
        value={stats.totalMeals.toLocaleString()}
        sub="Across every organisation on the platform."
      />

      <section className="px-5 py-5 bg-white border-b border-gray-200">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Weekly redistribution volume
        </p>
        <div className="mt-3 flex items-end gap-1.5 h-24">
          {WEEKS.map((w, i) => (
            <div key={w.label} className="flex-1 flex flex-col justify-end h-full">
              <div
                className={`rounded-t-md ${i === WEEKS.length - 1 ? 'bg-emerald-600' : 'bg-emerald-200'}`}
                style={{ height: `${w.value}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-gray-400">
          {WEEKS.map(w => (
            <span key={w.label}>{w.label}</span>
          ))}
        </div>
      </section>

      <MSection title="Platform health" />
      <div className="bg-white border-y border-gray-100 py-2">
        <MMeter label="Completion rate" score={completionRate} />
        <MMeter
          label="Pickup success"
          score={
            stats.totalDonations
              ? Math.round((stats.successfulPickups / stats.totalDonations) * 100)
              : 0
          }
        />
      </div>

      <MSection title="Key figures" />
      <MDetail label="Average meals per donation" value={avgPerDonation} />
      <MDetail label="Active donations" value={stats.activeDonations} />
      <MDetail label="Organisations" value={stats.totalOrganizations} />
      <MDetail label="Couriers" value={stats.totalVolunteers} />

      <MSection title="Food category mix" />
      {categories.map(([name, qty]) => (
        <div key={name} className="px-5 py-3 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-700 truncate">{name}</span>
            <span className="text-sm font-semibold text-gray-900 shrink-0">{qty}</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600"
              style={{ width: `${Math.round((qty / topCategory) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      <div className="h-4" />
    </>
  );
}
