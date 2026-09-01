import { Leaf, Trash2, Route } from 'lucide-react';
import { useDonations } from '../context/AppContext';
import { useCurrentUser } from '../context/AuthContext';
import { MHero, MSection, MDetail } from './parts';

const BARS = [38, 52, 30, 74, 58, 100];
const MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

export default function DonorImpact() {
  const user = useCurrentUser();
  const mine = useDonations().filter(d => d.donorId === user.id);
  const meals = mine.reduce((s, d) => s + d.quantity, 0);
  const km = mine.reduce((s, d) => s + (d.distanceKm ?? 0), 0);

  const byKitchen = new Map<string, number>();
  mine.forEach(d => {
    if (!d.recipientName) return;
    byKitchen.set(d.recipientName, (byKitchen.get(d.recipientName) ?? 0) + d.quantity);
  });
  const kitchens = [...byKitchen.entries()].sort((a, b) => b[1] - a[1]);
  const topShare = kitchens[0]?.[1] ?? 1;

  return (
    <>
      <MHero label="Meals rescued" value={meals} sub="Counted from every donation you have listed." />

      <section className="px-5 py-5 bg-white border-b border-gray-200">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Last six months</p>
        <div className="mt-3 flex items-end gap-1.5 h-24">
          {BARS.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end h-full">
              <div
                className={`rounded-t-md ${i === BARS.length - 1 ? 'bg-emerald-600' : 'bg-emerald-200'}`}
                style={{ height: `${h}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-gray-400">
          {MONTHS.map(m => (
            <span key={m}>{m}</span>
          ))}
        </div>
      </section>

      <MSection title="Environmental effect" />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Leaf size={14} className="text-emerald-600" /> CO₂ avoided
          </span>
        }
        value={`${Math.round(meals * 0.86)} kg`}
      />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Trash2 size={14} className="text-emerald-600" /> Kept out of landfill
          </span>
        }
        value={`${Math.round(meals * 0.45)} kg`}
      />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Route size={14} className="text-emerald-600" /> Courier distance
          </span>
        }
        value={`${km.toFixed(1)} km`}
      />

      <MSection title="Kitchens you supply" />
      {kitchens.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500 bg-white border-b border-gray-100">
          No kitchen has been matched to your surplus yet.
        </p>
      ) : (
        kitchens.map(([name, qty]) => (
          <div key={name} className="px-5 py-3 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
              <span className="text-sm font-semibold text-emerald-700 shrink-0">{qty}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${Math.round((qty / topShare) * 100)}%` }}
              />
            </div>
          </div>
        ))
      )}

      <div className="p-5">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="font-display font-semibold text-emerald-950">UN Sustainable Development Goals</p>
          <p className="mt-1 text-sm text-emerald-800 leading-relaxed">
            Every rescued meal contributes to Goal 2 (Zero Hunger) and Goal 12 (Responsible
            Consumption and Production).
          </p>
        </div>
      </div>
    </>
  );
}
