import { Package, Building2, Users, Heart, CheckCircle, Clock, Truck, AlertCircle } from 'lucide-react';
import StatCard from '../../components/StatCard';
import { useDonations, useStats, useActivity } from '../../context/AppContext';
import type { Donation } from '../../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CATEGORY_COLORS = [
  'bg-emerald-500', 'bg-amber-400', 'bg-blue-400', 'bg-purple-400', 'bg-rose-400', 'bg-gray-400',
];

/** Meals completed per weekday over the last seven days, from real records. */
function weeklyMeals(donations: Donation[]): number[] {
  const buckets = new Array(7).fill(0);
  const now = new Date();

  for (const donation of donations) {
    if (donation.status !== 'COMPLETED' || !donation.completedAt) continue;
    const when = new Date(donation.completedAt);
    const daysAgo = Math.floor((now.getTime() - when.getTime()) / 86_400_000);
    if (daysAgo < 0 || daysAgo > 6) continue;
    // getDay() is Sunday-first; DAYS starts on Monday.
    buckets[(when.getDay() + 6) % 7] += donation.quantity;
  }
  return buckets;
}

/** Share of listed quantity by food category. */
function categoryShare(donations: Donation[]): { label: string; pct: number; color: string }[] {
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

const ACTIVITY_ICON: Record<string, React.ReactNode> = {
  completed:          <div className="w-2 h-2 rounded-full bg-emerald-500" />,
  donation_accepted:  <div className="w-2 h-2 rounded-full bg-purple-500" />,
  volunteer_assigned: <div className="w-2 h-2 rounded-full bg-blue-500" />,
  donation_created:   <div className="w-2 h-2 rounded-full bg-amber-400" />,
  picked_up:          <div className="w-2 h-2 rounded-full bg-sky-500" />,
  delivered:          <div className="w-2 h-2 rounded-full bg-teal-500" />,
  donor_registered:   <div className="w-2 h-2 rounded-full bg-gray-400" />,
};

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminDashboard() {
  const donations = useDonations();
  const stats = useStats();
  const activity = useActivity();

  const active = donations.filter(
    d => !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(d.status),
  ).length;
  const totalMeals = donations.reduce((s, d) => s + d.quantity, 0);

  const MEAL_DATA = weeklyMeals(donations);
  const CATEGORIES = categoryShare(donations);
  // Keeps the bars from collapsing to nothing on a quiet week.
  const maxMeals = Math.max(1, ...MEAL_DATA);

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
        <p className="text-gray-500 mt-1">FoodLink AI — Admin Control Panel</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Donations" value={stats.totalDonations} icon={Package} color="emerald" />
        <StatCard label="Organizations" value={stats.totalOrganizations} icon={Building2} color="blue" />
        <StatCard label="Volunteers" value={stats.totalVolunteers} icon={Users} color="purple" />
        <StatCard label="Meals Redistributed" value={(totalMeals).toLocaleString()} icon={Heart} color="rose" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Completed" value={stats.completedDonations} icon={CheckCircle} color="emerald" />
        <StatCard label="Active Donations" value={active} icon={Clock} color="amber" />
        <StatCard label="Successful Pickups" value={stats.successfulPickups} icon={Truck} color="blue" />
      </div>

      {/* Charts + Activity */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Meals chart */}
        <div className="card p-6 lg:col-span-2 flex flex-col">
          <h2 className="section-title mb-5">Meals Redistributed — This Week</h2>
          <div className="flex items-end gap-3 flex-1 min-h-[10rem]">
            {MEAL_DATA.map((val, i) => {
              const height = (val / maxMeals) * 100;
              return (
                <div key={i} className="flex-1 h-full flex flex-col items-center gap-1.5">
                  <span className="text-xs text-gray-400 font-medium">{val}</span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full bg-emerald-600 rounded-t-lg transition-all duration-700 hover:bg-emerald-700"
                      style={{ height: `${height}%`, minHeight: '6px' }}
                      title={`${DAYS[i]}: ${val} meals`}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{DAYS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Categories */}
        <div className="card p-6">
          <h2 className="section-title mb-5">Food Categories</h2>
          <div className="space-y-3">
            {CATEGORIES.map(cat => (
              <div key={cat.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{cat.label}</span>
                  <span className="text-gray-500 font-semibold">{cat.pct}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${cat.color} rounded-full transition-all duration-700`}
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
            {[
              { label: 'Meals Redistributed', value: totalMeals.toLocaleString() },
              { label: 'Successful Pickups', value: stats.successfulPickups },
              { label: 'Active Organizations', value: stats.totalOrganizations },
              { label: 'Active Volunteers', value: stats.totalVolunteers },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="font-bold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity + Donations table */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activity */}
        <div className="card p-6">
          <h2 className="section-title mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {activity.slice(0, 8).map(log => (
              <div key={log.id} className="flex items-start gap-3">
                <div className="mt-1.5 shrink-0">
                  {ACTIVITY_ICON[log.type] ?? <div className="w-2 h-2 rounded-full bg-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{log.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(log.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Intelligence Roadmap */}
        <div className="card p-6">
          <h2 className="section-title mb-4">Intelligence Roadmap</h2>
          <div className="space-y-4">
            {[
              { phase: 'Current Prototype', color: 'text-emerald-600 bg-emerald-50', items: ['Rule-based donor-recipient matching', 'Complete donation lifecycle', 'Role-based dashboards'], done: true },
              { phase: 'Prototype 2', color: 'text-purple-600 bg-purple-50', items: ['ML-assisted recipient ranking', 'Demand-aware redistribution', 'Volunteer route optimization'], done: false },
              { phase: 'Advanced Phase', color: 'text-blue-600 bg-blue-50', items: ['AI food image categorization', 'NLP donation understanding', 'Community heatmap'], done: false },
            ].map(phase => (
              <div key={phase.phase} className={`rounded-xl p-4 ${phase.color}`}>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-2">
                  {phase.done ? <CheckCircle size={13} /> : <Clock size={13} />}
                  {phase.phase}
                </p>
                {phase.items.map(item => (
                  <div key={item} className="flex items-start gap-2 mb-1">
                    <div className={`w-3 h-3 rounded-full border-2 mt-0.5 shrink-0 ${phase.done ? 'bg-emerald-500 border-emerald-500' : 'border-current'}`} />
                    <span className="text-xs">{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All donations table */}
      <div className="card p-6">
        <h2 className="section-title mb-4">All Donations</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['ID', 'Food', 'Donor', 'Quantity', 'Status', 'Recipient', 'Created'].map(h => (
                  <th key={h} className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {donations.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pr-4 text-gray-400 font-mono text-xs">{d.id}</td>
                  <td className="py-3 pr-4 font-medium text-gray-900">{d.foodName}</td>
                  <td className="py-3 pr-4 text-gray-600">{d.donorOrganization}</td>
                  <td className="py-3 pr-4 text-gray-600">{d.quantity} {d.unit}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      d.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700'
                      : d.status === 'AVAILABLE' ? 'bg-blue-100 text-blue-700'
                      : d.status === 'MATCHED' ? 'bg-purple-100 text-purple-700'
                      : d.status === 'ACCEPTED' ? 'bg-amber-100 text-amber-700'
                      : 'bg-sky-100 text-sky-700'
                    }`}>
                      {d.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-600 text-xs">{d.recipientName ?? '—'}</td>
                  <td className="py-3 text-gray-400 text-xs">
                    {new Date(d.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
