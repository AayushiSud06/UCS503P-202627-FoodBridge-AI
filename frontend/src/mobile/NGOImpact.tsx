import { Users, Utensils, Building2 } from 'lucide-react';
import { useDonations, useMyRecipient } from '../context/AppContext';
import { useCurrentUser } from '../context/AuthContext';
import { MHero, MSection, MDetail, MMeter } from './parts';

const DEMOGRAPHICS: [string, number][] = [
  ['Children', 42],
  ['Elderly', 27],
  ['Adults', 31],
];

export default function NGOImpact() {
  const user = useCurrentUser();
  const me = useMyRecipient();
  const capacity = me?.capacity ?? 100;
  const mine = useDonations().filter(d => d.recipientId === user.entityId);
  const completed = mine.filter(d => d.status === 'COMPLETED');
  const meals = completed.reduce((s, d) => s + d.quantity, 0);
  const donors = new Set(mine.map(d => d.donorOrganization)).size;
  const utilisation = Math.min(100, Math.round((meals / Math.max(capacity, 1)) * 100));

  return (
    <>
      <MHero
        label="Meals served"
        value={meals}
        sub={`Received from ${donors} donor organisation${donors === 1 ? '' : 's'}.`}
      />

      <MSection title="Intake summary" />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Utensils size={14} className="text-emerald-600" /> Collections completed
          </span>
        }
        value={completed.length}
      />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Building2 size={14} className="text-emerald-600" /> Donor organisations
          </span>
        }
        value={donors}
      />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Users size={14} className="text-emerald-600" /> People fed (est.)
          </span>
        }
        value={Math.round(meals * 0.92)}
      />

      <MSection title="Capacity utilisation" />
      <div className="bg-white border-y border-gray-100 py-2">
        <MMeter label={`Against ${capacity} meal capacity`} score={utilisation} />
        <MMeter label="Intake reliability rating" score={(me?.reliabilityScore ?? 0)} />
      </div>

      <MSection title="Beneficiary mix" />
      <div className="bg-white border-y border-gray-100 py-2">
        {DEMOGRAPHICS.map(([label, pct]) => (
          <MMeter key={label} label={label} score={pct} />
        ))}
      </div>

      <div className="p-5">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="font-display font-semibold text-emerald-950">Verified kitchen standards</p>
          <p className="mt-1 text-sm text-emerald-800 leading-relaxed">
            {me?.name ?? 'Your organisation'} maintains a {(me?.reliabilityScore ?? 0)}% intake reliability rating
            across {(me?.acceptedDonations ?? 0)} accepted donations.
          </p>
        </div>
      </div>
    </>
  );
}
