import { BarChart2, TrendingUp, Zap, Clock, ShieldCheck, PieChart, Sparkles } from 'lucide-react';
import StatCard from '../../components/StatCard';
import FutureIntelligenceSection from '../../components/FutureIntelligenceSection';
import { useStats, useDonations } from '../../context/AppContext';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_DATA = [420, 680, 590, 840, 920, 1140, 400];
const MAX_VAL = Math.max(...MEAL_DATA);

const CATEGORIES = [
  { label: 'Vegetarian Cooked Meals', pct: 58, color: 'bg-emerald-500' },
  { label: 'Bakery & Bread', pct: 20, color: 'bg-amber-400' },
  { label: 'Fresh Fruits & Vegetables', pct: 14, color: 'bg-blue-400' },
  { label: 'Packaged Rations', pct: 8, color: 'bg-purple-400' },
];

export default function AdminAnalytics() {
  const stats = useStats();
  const donations = useDonations();

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Intelligence Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Deep telemetry on food redistribution throughput, AI matching efficiency, and waste reduction curves.
        </p>
      </div>

      {/* Primary KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Meals Redistributed" value={(stats.totalMeals).toLocaleString()} icon={TrendingUp} color="emerald" trend="+31% this month" />
        <StatCard label="Avg AI Match Time" value="1.4 min" icon={Zap} color="purple" trend="Rule-based MAUT" />
        <StatCard label="Avg Courier Transit" value="34 min" icon={Clock} color="blue" trend="Within safety window" />
        <StatCard label="Redistribution Success" value="98.2%" icon={ShieldCheck} color="rose" trend="Zero spoilage" />
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Throughput Chart */}
        <div className="card p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Weekly Redistribution Volume (Meals)</h2>
              <p className="text-xs text-gray-500">Aggregated intake across all verified municipal kitchens</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              4,990 Meals This Week
            </span>
          </div>

          <div className="flex items-end gap-3 h-52 pt-6">
            {MEAL_DATA.map((val, i) => {
              const height = (val / MAX_VAL) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[11px] text-gray-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    {val}
                  </span>
                  <div
                    className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-lg transition-all duration-500 group-hover:from-emerald-700 group-hover:to-teal-500 shadow-sm"
                    style={{ height: `${height}%`, minHeight: '12px' }}
                  />
                  <span className="text-xs font-medium text-gray-600 mt-1">{DAYS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="card p-6 space-y-4">
          <h2 className="section-title">Food Category Distribution</h2>
          <div className="space-y-3 pt-2">
            {CATEGORIES.map(cat => (
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

          <div className="pt-4 border-t border-gray-100 space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>FSSAI Compliance Rate</span>
              <strong className="text-emerald-700 font-bold">100%</strong>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Avg Match Compatibility</span>
              <strong className="text-purple-700 font-bold">92.4%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Future Intelligence Architecture Roadmap */}
      <FutureIntelligenceSection />
    </div>
  );
}
