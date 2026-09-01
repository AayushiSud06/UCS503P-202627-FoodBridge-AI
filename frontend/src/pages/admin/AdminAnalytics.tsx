import { TrendingUp, Zap, Clock, ShieldCheck } from 'lucide-react';
import StatCard from '../../components/StatCard';
import FutureIntelligenceSection from '../../components/FutureIntelligenceSection';
import { useStats, useDonations } from '../../context/AppContext';
import type { Donation } from '../../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CATEGORY_COLORS = [
  'bg-emerald-500', 'bg-amber-400', 'bg-blue-400', 'bg-purple-400', 'bg-rose-400', 'bg-gray-400',
];

/** Meals completed per weekday over the last seven days. */
function weeklyMeals(donations: Donation[]): number[] {
  const buckets = new Array(7).fill(0);
  const now = new Date();

  for (const donation of donations) {
    if (donation.status !== 'COMPLETED' || !donation.completedAt) continue;
    const when = new Date(donation.completedAt);
    const daysAgo = Math.floor((now.getTime() - when.getTime()) / 86_400_000);
    if (daysAgo < 0 || daysAgo > 6) continue;
    buckets[(when.getDay() + 6) % 7] += donation.quantity;
  }
  return buckets;
}

function categoryShare(donations: Donation[]) {
  const totals = new Map<string, number>();
  for (const d of donations) totals.set(d.category, (totals.get(d.category) ?? 0) + d.quantity);

  const grand = [...totals.values()].reduce((a, b) => a + b, 0);
  if (grand === 0) return [];

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, CATEGORY_COLORS.length)
    .map(([label, quantity], i) => ({
      label,
      pct: Math.round((100 * quantity) / grand),
      color: CATEGORY_COLORS[i],
    }));
}

/** Minutes as "1.4 min" / "34 min" / "2h 10m", or a dash when unmeasured. */
function minutes(value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  if (value < 1) return '<1 min';
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  return `${hours}h ${Math.round(value % 60)}m`;
}

function percent(value: number | undefined): string {
  return value === undefined || value === null ? '—' : `${value}%`;
}

/**
 * The evaluation figures the project proposal commits to.
 *
 * Every one is derived server-side from `status_events`, which are stamped at
 * the moment of each transition — nothing here is self-reported, and nothing
 * is a placeholder. A dash means the platform has not yet seen enough
 * completed donations to compute it, which is a more useful thing to show than
 * an invented number.
 */
export default function AdminAnalytics() {
  const stats = useStats();
  const donations = useDonations();

  const mealData = weeklyMeals(donations);
  const categories = categoryShare(donations);
  const maxVal = Math.max(1, ...mealData);
  const weekTotal = mealData.reduce((a, b) => a + b, 0);

  const avgMatchScore = (() => {
    const scored = donations.filter(d => typeof d.matchScore === 'number');
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((s, d) => s + (d.matchScore ?? 0), 0) / scored.length);
  })();

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics &amp; Intelligence Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Throughput, matching efficiency and loss rates — all derived from server-stamped
          lifecycle history rather than self-reported figures.
        </p>
      </div>

      {/* Primary KPI row — the proposal's evaluation metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Meals Redistributed"
          value={stats.totalMeals.toLocaleString()}
          icon={TrendingUp}
          color="emerald"
          trend={`${stats.completedDonations} completed donations`}
        />
        <StatCard
          label="Median Time to Claim"
          value={minutes(stats.medianTimeToClaimMinutes)}
          icon={Zap}
          color="purple"
          trend="Posting → a kitchen accepting"
        />
        <StatCard
          label="Median Handover"
          value={minutes(stats.medianHandoverMinutes)}
          icon={Clock}
          color="blue"
          trend="Acceptance → delivery"
        />
        <StatCard
          label="Rescue Rate"
          value={percent(stats.rescueRatePercent)}
          icon={ShieldCheck}
          color="rose"
          trend={
            stats.expiryLossRatePercent !== undefined
              ? `${stats.expiryLossRatePercent}% expired unclaimed`
              : 'Completed before deadline'
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly throughput */}
        <div className="card p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="section-title">Weekly Redistribution Volume (Meals)</h2>
              <p className="text-xs text-gray-500">Completed donations over the last seven days</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              {weekTotal.toLocaleString()} meals this week
            </span>
          </div>

          <div className="flex items-end gap-3 h-52 pt-6">
            {mealData.map((val, i) => {
              const height = (val / maxVal) * 100;
              return (
                <div key={DAYS[i]} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[11px] text-gray-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    {val}
                  </span>
                  <div
                    className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-lg transition-all duration-500 group-hover:from-emerald-700 group-hover:to-teal-500 shadow-sm"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  />
                  <span className="text-xs font-medium text-gray-600 mt-1">{DAYS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="card p-6 space-y-4">
          <h2 className="section-title">Food Category Distribution</h2>

          {categories.length === 0 ? (
            <p className="text-sm text-gray-500 pt-2">No donations listed yet.</p>
          ) : (
            <div className="space-y-3 pt-2">
              {categories.map(cat => (
                <div key={cat.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-gray-700">
                    <span>{cat.label}</span>
                    <span className="font-bold">{cat.pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${cat.color} rounded-full`} style={{ width: `${cat.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Expired unclaimed</span>
              <strong className="text-gray-900 font-bold">{stats.expiredDonations ?? 0}</strong>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Avg match compatibility</span>
              <strong className="text-purple-700 font-bold">
                {avgMatchScore === null ? '—' : `${avgMatchScore}%`}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <FutureIntelligenceSection />
    </div>
  );
}
