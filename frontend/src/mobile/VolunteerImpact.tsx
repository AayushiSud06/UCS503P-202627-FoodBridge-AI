import { Route, Star, Utensils } from 'lucide-react';
import { useDonations } from '../context/AppContext';
import { MOCK_VOLUNTEERS } from '../data/mockData';
import { VOLUNTEER_ID } from './nav';
import { MHero, MSection, MDetail, MMeter } from './parts';

const ME = MOCK_VOLUNTEERS.find(v => v.id === VOLUNTEER_ID)!;

export default function VolunteerImpact() {
  const mine = useDonations().filter(d => d.volunteerId === VOLUNTEER_ID);
  const done = mine.filter(d => ['DELIVERED', 'COMPLETED'].includes(d.status));
  const meals = done.reduce((s, d) => s + d.quantity, 0);
  const km = mine.reduce((s, d) => s + (d.distanceKm ?? 0), 0);
  const runs = ME.completedDeliveries + done.length;

  return (
    <>
      <MHero
        label="Meals delivered"
        value={meals}
        sub={`Across ${runs} completed run${runs === 1 ? '' : 's'} for FoodLink.`}
      />

      <MSection title="Your record" />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Utensils size={14} className="text-emerald-600" /> Runs completed
          </span>
        }
        value={runs}
      />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Route size={14} className="text-emerald-600" /> Distance covered
          </span>
        }
        value={`${km.toFixed(1)} km`}
      />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Star size={14} className="text-emerald-600" /> Courier rating
          </span>
        }
        value={`${ME.rating} / 5`}
      />

      <MSection title="Reliability" />
      <div className="bg-white border-y border-gray-100 py-2">
        <MMeter label="On-time collection rate" score={94} />
        <MMeter label="Deliveries without incident" score={100} />
        <MMeter label="Rating" score={Math.round((ME.rating / 5) * 100)} />
      </div>

      <div className="p-5">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="font-display font-semibold text-emerald-950">Why the last mile matters</p>
          <p className="mt-1 text-sm text-emerald-800 leading-relaxed">
            A match only becomes a meal when someone moves the food. Your {runs} runs are the step
            that turned {meals} listed meals into served ones.
          </p>
        </div>
      </div>
    </>
  );
}
