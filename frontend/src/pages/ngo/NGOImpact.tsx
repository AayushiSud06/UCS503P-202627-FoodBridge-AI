import { Heart, Package, Building2, Gauge, ShieldCheck, ShieldAlert } from 'lucide-react';
import ImpactCard from '../../components/ImpactCard';
import { useDonations, useMyRecipient } from '../../context/AppContext';
import { useCurrentUser } from '../../context/AuthContext';
import { ngoImpact } from '../../lib/impact';

export default function NGOImpact() {
  const user = useCurrentUser();
  const me = useMyRecipient();
  const impact = ngoImpact(useDonations(), user.entityId ?? '');
  const who = me?.name ?? user.organization ?? user.name;

  // The reliability figure is the server's own: completions over acceptances,
  // held at 85 until an organisation has three acceptances to judge. Repeating
  // that rule here would put a second definition in the client.
  const reliability = me?.reliabilityScore;
  const isProvisional = (me?.acceptedDonations ?? 0) < 3;

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Community Intake Record</h1>
        <p className="text-gray-500 mt-1">
          Counted from the donations <strong>{who}</strong> accepted and confirmed receiving.
          Distribution beyond that handover is not recorded by FoodLink.
        </p>
      </div>

      {/* Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ImpactCard
          title="Quantity Received"
          value={impact.servedMeals}
          unit="Meals"
          subtitle="Confirmed on collection, in the units the donor listed."
          icon={Heart}
          color="rose"
        />
        <ImpactCard
          title="Collections Completed"
          value={impact.collections}
          unit={`of ${impact.acceptedCount} in your list`}
          subtitle="Donations bound to you that reached confirmed receipt."
          icon={Package}
          color="emerald"
        />
        <ImpactCard
          title="Donor Organisations"
          value={impact.donors.length}
          unit={impact.donors.length === 1 ? 'Kitchen' : 'Kitchens'}
          subtitle="Distinct donors whose surplus you have received."
          icon={Building2}
          color="blue"
        />
        <ImpactCard
          title="Intake Reliability"
          value={reliability ?? '—'}
          unit={reliability === undefined ? undefined : '%'}
          subtitle={
            reliability === undefined
              ? 'Available once your organisation profile loads.'
              : isProvisional
                ? 'Provisional starting score — fewer than 3 acceptances to judge on.'
                : 'Server tally: completions over acceptances, across your whole history.'
          }
          icon={Gauge}
          color="purple"
        />
      </div>

      {/* Who supplies this kitchen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 space-y-1">
          <h2 className="section-title">Where Your Food Comes From</h2>
          <p className="text-xs text-gray-500 pb-3">
            Share of received quantity by donor organisation.
          </p>
          {impact.donors.length === 0 ? (
            <p className="text-sm text-gray-500">
              No collection has been completed yet. Accept a donation and confirm receipt to
              start this record.
            </p>
          ) : (
            <div className="space-y-3">
              {impact.donors.map(donor => (
                <div key={donor.label}>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span className="truncate pr-3">{donor.label}</span>
                    <span className="shrink-0">
                      {donor.meals} · {donor.percent}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${donor.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6 bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 text-white space-y-3">
          <div className="flex items-center gap-2">
            {me?.isVerified ? (
              <ShieldCheck className="text-emerald-400" size={20} />
            ) : (
              <ShieldAlert className="text-amber-400" size={20} />
            )}
            <h3 className="font-bold text-base">Your Organisation Record</h3>
          </div>
          <p className="text-xs text-emerald-200 leading-relaxed">
            {me?.isVerified
              ? `${who} has been verified by a FoodLink administrator and can accept donations.`
              : `${who} is not verified yet. An administrator must verify the organisation before it can accept donations.`}
          </p>
          <div className="pt-2 border-t border-emerald-800/80 grid grid-cols-2 gap-3 text-xs text-emerald-100">
            <div>
              <span className="text-emerald-400 font-bold block text-sm">
                {me?.acceptedDonations ?? 0}
              </span>
              Acceptances on record
            </div>
            <div>
              <span className="text-emerald-400 font-bold block text-sm">{me?.capacity ?? '—'}</span>
              Stated intake capacity
            </div>
          </div>
          <p className="text-[11px] text-emerald-300/80 leading-relaxed">
            The acceptance tally is the server counter behind the reliability score, covering your
            whole history — the cards above count only the donations in your current list. Capacity
            is the figure your organisation entered on its profile; the matcher reads it when
            ranking donations, and it is not a measurement FoodLink takes.
          </p>
        </div>
      </div>
    </div>
  );
}
