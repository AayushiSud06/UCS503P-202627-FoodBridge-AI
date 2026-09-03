import { Building2, Utensils, ShieldCheck } from 'lucide-react';
import { useDonations, useMyRecipient } from '../context/AppContext';
import { useCurrentUser } from '../context/AuthContext';
import { ngoImpact } from '../lib/impact';
import { MHero, MSection, MDetail, MMeter, MShare } from './parts';

export default function NGOImpact() {
  const user = useCurrentUser();
  const me = useMyRecipient();
  const impact = ngoImpact(useDonations(), user.entityId ?? '');
  const donors = impact.donors.length;

  return (
    <>
      <MHero
        label="Quantity received"
        value={impact.servedMeals}
        sub={`Confirmed on collection from ${donors} donor organisation${donors === 1 ? '' : 's'}.`}
      />

      <MSection title="Intake summary" />
      <MDetail
        label={
          <span className="inline-flex items-center gap-2">
            <Utensils size={14} className="text-emerald-600" /> Collections completed
          </span>
        }
        value={`${impact.collections} of ${impact.acceptedCount} in your list`}
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
            <ShieldCheck size={14} className="text-emerald-600" /> Verification
          </span>
        }
        value={me?.isVerified ? 'Verified' : 'Not verified'}
      />

      <MSection title="Intake reliability" />
      <div className="bg-white border-y border-gray-100 py-2">
        <MMeter
          label={
            (me?.acceptedDonations ?? 0) < 3
              ? 'Provisional score — under 3 acceptances'
              : 'Accepted donations you completed'
          }
          score={me?.reliabilityScore ?? 0}
        />
      </div>

      <MSection title="Where your food comes from" />
      {impact.donors.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500 bg-white border-b border-gray-100">
          No collection completed yet.
        </p>
      ) : (
        impact.donors.map(donor => (
          <MShare
            key={donor.label}
            label={donor.label}
            value={donor.meals}
            percent={donor.percent}
          />
        ))
      )}

      <div className="p-5">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="font-display font-semibold text-emerald-950">What this page counts</p>
          <p className="mt-1 text-sm text-emerald-800 leading-relaxed">
            The server records {me?.acceptedDonations ?? 0} acceptance
            {(me?.acceptedDonations ?? 0) === 1 ? '' : 's'} for {me?.name ?? 'your organisation'}{' '}
            across its whole history, which is what the reliability score above is computed from;
            the counts above it cover only the donations in your current list. Either way the
            record ends at the handover — what happens after a collection is confirmed is not
            something FoodLink observes.
          </p>
        </div>
      </div>
    </>
  );
}
