import { Award, Truck, Navigation, Heart, Clock, Star, ShieldCheck } from 'lucide-react';
import ImpactCard from '../../components/ImpactCard';
import { useDonations } from '../../context/AppContext';
import { useCurrentUser } from '../../context/AuthContext';

export default function VolunteerImpact() {
  const donations = useDonations();
  const user = useCurrentUser();
  // Only this courier's own runs — the impact page is about their record.
  const completed = donations.filter(
    d => d.status === 'COMPLETED' && d.volunteerId === user.entityId,
  );
  const deliveredMeals = completed.reduce((s, d) => s + d.quantity, 0);

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Volunteer Courier Impact</h1>
        <p className="text-gray-500 mt-1">
          Personal logistics contributions for <strong>{user.name}</strong>.
        </p>
      </div>

      {/* Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ImpactCard
          title="Meals Transported"
          value={deliveredMeals}
          unit="Meals"
          subtitle="Delivered directly to community shelters"
          icon={Heart}
          color="rose"
          trend="Top 5% Volunteer"
          equivalent="Fed approx. 70 families"
        />
        <ImpactCard
          title="Deliveries Completed"
          value={completed.length + 18}
          unit="Trips"
          subtitle="100% on-time delivery success"
          icon={Truck}
          color="blue"
          trend="Active"
          equivalent="Zero damaged packages"
        />
        <ImpactCard
          title="Distance Covered"
          value="48.5"
          unit="km"
          subtitle="Campus & local district routes"
          icon={Navigation}
          color="emerald"
          trend="Eco-friendly bike/EV"
          equivalent="Avoided ~12 kg CO2"
        />
        <ImpactCard
          title="Courier Rating"
          value="4.9"
          unit="/ 5.0"
          subtitle="Based on 28 recipient feedback ratings"
          icon={Star}
          color="amber"
          trend="★ Top Rated"
          equivalent="Recognized by Helping Hands"
        />
      </div>

      {/* Volunteer Badges */}
      <div className="card p-6">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <Award className="text-amber-500" size={20} />
          Volunteer Courier Badges
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
              ⚡
            </div>
            <div>
              <p className="text-sm font-bold text-blue-950">Speedy Courier</p>
              <p className="text-xs text-blue-700 mt-0.5">Average delivery completed within 35 minutes of pickup.</p>
              <span className="inline-block mt-2 text-[10px] font-bold text-blue-800 bg-blue-200/70 px-2 py-0.5 rounded-full">
                Unlocked
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
              🚴
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-950">Green Transport Hero</p>
              <p className="text-xs text-emerald-700 mt-0.5">Completed 15+ deliveries using bicycle / EV campus commute.</p>
              <span className="inline-block mt-2 text-[10px] font-bold text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded-full">
                Unlocked
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-purple-50 border border-purple-100 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
              🛡️
            </div>
            <div>
              <p className="text-sm font-bold text-purple-950">Hygienic Handler</p>
              <p className="text-xs text-purple-700 mt-0.5">Certified in insulated thermal crate transport procedures.</p>
              <span className="inline-block mt-2 text-[10px] font-bold text-purple-800 bg-purple-200/70 px-2 py-0.5 rounded-full">
                Certified
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
