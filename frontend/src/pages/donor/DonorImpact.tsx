import { Package, Leaf, Droplets, Heart, Award, TrendingUp, CheckCircle, Download } from 'lucide-react';
import ImpactCard from '../../components/ImpactCard';
import { useDonations } from '../../context/AppContext';

export default function DonorImpact() {
  const donations = useDonations();
  const myDonations = donations.filter(d => d.donorId === 'u-donor-1');
  const totalMeals = myDonations.reduce((sum, d) => sum + d.quantity, 0) + 120;
  const completedMeals = myDonations
    .filter(d => d.status === 'COMPLETED')
    .reduce((sum, d) => sum + d.quantity, 0) + 96;

  // Environmental equivalency formulas
  const co2AvoidedKg = Math.round(completedMeals * 2.5); // ~2.5 kg CO2e per kg food saved
  const waterSavedLiters = Math.round(completedMeals * 85); // ~85L water embedded per meal

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Sustainability & Community Impact</h1>
          <p className="text-gray-500 mt-1">
            Real-time environmental and hunger relief statistics for <strong>College Central Mess</strong>.
          </p>
        </div>
        <button
          onClick={() => alert('Downloading Verified Impact Certificate (PDF)...')}
          className="btn-secondary text-xs"
        >
          <Download size={14} /> Download Impact Report
        </button>
      </div>

      {/* Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ImpactCard
          title="Meals Donated"
          value={totalMeals}
          unit="Meals"
          subtitle="Redistributed to verified local community kitchens"
          icon={Package}
          color="emerald"
          trend="+18% this month"
          equivalent="Fed approx. 54 families"
        />
        <ImpactCard
          title="CO₂ Emissions Avoided"
          value={co2AvoidedKg}
          unit="kg CO₂e"
          subtitle="Methane prevention from avoided landfill decay"
          icon={Leaf}
          color="teal"
          trend="Certified SDG 12.3"
          equivalent="Equal to 420 km car travel"
        />
        <ImpactCard
          title="Virtual Water Saved"
          value={waterSavedLiters}
          unit="Liters"
          subtitle="Conserved agricultural water footprint"
          icon={Droplets}
          color="blue"
          trend="Saved"
          equivalent="Equivalent to 550 showers"
        />
        <ImpactCard
          title="Organizations Fed"
          value={5}
          unit="Shelters"
          subtitle="Active community kitchen partnerships"
          icon={Heart}
          color="rose"
          trend="100% verified"
          equivalent="Across Patiala & Chandigarh"
        />
      </div>

      {/* Impact Badges */}
      <div className="card p-6">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <Award className="text-amber-500" size={20} />
          Campus Sustainability Achievements
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
              🌱
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-950">Zero Food Waste Pioneer</p>
              <p className="text-xs text-emerald-700 mt-0.5">Redirected &gt;500 meals away from university organic waste.</p>
              <span className="inline-block mt-2 text-[10px] font-bold text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded-full">
                Unlocked · Tier 2
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
              ⚡
            </div>
            <div>
              <p className="text-sm font-bold text-blue-950">Rapid Responder</p>
              <p className="text-xs text-blue-700 mt-0.5">Average pickup readiness under 30 minutes from listing.</p>
              <span className="inline-block mt-2 text-[10px] font-bold text-blue-800 bg-blue-200/70 px-2 py-0.5 rounded-full">
                Unlocked · 98% Rating
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-purple-50 border border-purple-100 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0">
              🤝
            </div>
            <div>
              <p className="text-sm font-bold text-purple-950">Community Anchor</p>
              <p className="text-xs text-purple-700 mt-0.5">Consistent weekly donations to Helping Hands NGO.</p>
              <span className="inline-block mt-2 text-[10px] font-bold text-purple-800 bg-purple-200/70 px-2 py-0.5 rounded-full">
                Tier 3 Partner
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown by Food Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="section-title mb-4">Donation History Distribution</h2>
          <div className="space-y-3">
            {[
              { label: 'Nutritious Cooked Meals', pct: 68, color: 'bg-emerald-500' },
              { label: 'Fresh Bakery & Bread', pct: 18, color: 'bg-amber-400' },
              { label: 'Fruits & Raw Produce', pct: 10, color: 'bg-blue-400' },
              { label: 'Packaged Snacks', pct: 4, color: 'bg-purple-400' },
            ].map(cat => (
              <div key={cat.label}>
                <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                  <span>{cat.label}</span>
                  <span>{cat.pct}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${cat.color} rounded-full`} style={{ width: `${cat.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-br from-emerald-900 to-teal-900 text-white">
          <h2 className="text-lg font-bold mb-2">UN Sustainable Development Goals</h2>
          <p className="text-xs text-emerald-200 mb-4 leading-relaxed">
            Your mess contributions directly align with UN SDG Target 12.3: Halving global food waste by 2030 and SDG 2: Zero Hunger.
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
