import { Heart, Users, Package, Clock, Award, ShieldCheck, Download } from 'lucide-react';
import ImpactCard from '../../components/ImpactCard';
import { useDonations } from '../../context/AppContext';
import { useCurrentUser } from '../../context/AuthContext';

export default function NGOImpact() {
  const donations = useDonations();
  const user = useCurrentUser();
  const completed = donations.filter(d => d.status === 'COMPLETED' && d.recipientId === user.entityId);
  const mealsDistributed = completed.reduce((sum, d) => sum + d.quantity, 0) + 1240;

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Community Nutrition & Intake Impact</h1>
          <p className="text-gray-500 mt-1">
            Verified hunger relief and meal distribution metrics for <strong>{user.organization ?? user.name}</strong>.
          </p>
        </div>
        <button
          onClick={() => alert('Generating NGO Impact & Auditing Statement...')}
          className="btn-secondary text-xs"
        >
          <Download size={14} /> Export Community Report
        </button>
      </div>

      {/* Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ImpactCard
          title="Total Meals Served"
          value={mealsDistributed}
          unit="Meals"
          subtitle="Directly distributed across 3 community dining centers"
          icon={Heart}
          color="rose"
          trend="+24% vs last month"
          equivalent="Serving ~150 individuals daily"
        />
        <ImpactCard
          title="Beneficiaries Reached"
          value="850+"
          unit="People"
          subtitle="Daily-wage workers, children & senior citizens"
          icon={Users}
          color="blue"
          trend="Active"
          equivalent="Zero meal shortages recorded"
        />
        <ImpactCard
          title="Verified Donors Linked"
          value={8}
          unit="Kitchens"
          subtitle="University messes, banquet halls & bakeries"
          icon={Package}
          color="emerald"
          trend="AI Matched"
          equivalent="Average distance: 2.1 km"
        />
        <ImpactCard
          title="Average Delivery Time"
          value="42"
          unit="mins"
          subtitle="From donor listing to hot distribution"
          icon={Clock}
          color="purple"
          trend="Rapid Logistics"
          equivalent="100% food safety intact"
        />
      </div>

      {/* Beneficiary Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 space-y-4">
          <h2 className="section-title">Beneficiary Distribution Demographics</h2>
          <div className="space-y-3">
            {[
              { group: 'Migrant & Daily Wage Families', pct: 45, color: 'bg-emerald-500' },
              { group: 'Children & After-School Programs', pct: 30, color: 'bg-blue-500' },
              { group: 'Senior Citizens & Sheltered Individuals', pct: 20, color: 'bg-purple-500' },
              { group: 'Emergency / Transient Support', pct: 5, color: 'bg-amber-400' },
            ].map(item => (
              <div key={item.group}>
                <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                  <span>{item.group}</span>
                  <span>{item.pct}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 text-white space-y-3">
          <div className="flex items-center gap-2">
            <Award className="text-emerald-400" size={20} />
            <h3 className="font-bold text-base">Verified Community Kitchen Standards</h3>
          </div>
          <p className="text-xs text-emerald-200 leading-relaxed">
            {user.organization ?? 'This organisation'} operates in compliance with national community feeding protocols with clean water filtration, warm-reheating equipment, and rapid distribution queues.
          </p>
          <div className="pt-2 border-t border-emerald-800/80 grid grid-cols-2 gap-3 text-xs text-emerald-100">
            <div>
              <span className="text-emerald-400 font-bold block text-sm">95%</span>
              Intake Reliability Rating
            </div>
            <div>
              <span className="text-emerald-400 font-bold block text-sm">150</span>
              Simultaneous Intake Capacity
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
