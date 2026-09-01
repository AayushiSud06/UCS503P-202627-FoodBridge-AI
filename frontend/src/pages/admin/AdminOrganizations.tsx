import { Building2, ShieldCheck, MapPin, Heart, CheckCircle2, Loader2 } from 'lucide-react';
import { useDonations, useRecipients, useApp } from '../../context/AppContext';
import { useAction } from '../../lib/hooks';
import type { Donation } from '../../types';

/**
 * Donor organisations are not a table of their own — a donor *is* an account,
 * and its organisation is a field on it. Their record is therefore folded out
 * of the donations they have posted, which is also the only honest source for
 * "how much have they contributed".
 */
interface DonorOrg {
  id: string;
  name: string;
  contactPerson: string;
  donationsCount: number;
  mealsContributed: number;
  locations: string[];
}

function donorOrgs(donations: Donation[]): DonorOrg[] {
  const byOrg = new Map<string, DonorOrg>();

  for (const donation of donations) {
    const name = donation.donorOrganization || donation.donorName;
    const delivered = ['DELIVERED', 'COMPLETED'].includes(donation.status);
    const existing = byOrg.get(name);

    if (existing) {
      existing.donationsCount += 1;
      if (delivered) existing.mealsContributed += donation.quantity;
      if (!existing.locations.includes(donation.location)) {
        existing.locations.push(donation.location);
      }
    } else {
      byOrg.set(name, {
        id: donation.donorId,
        name,
        contactPerson: donation.donorName,
        donationsCount: 1,
        mealsContributed: delivered ? donation.quantity : 0,
        locations: [donation.location],
      });
    }
  }

  return [...byOrg.values()].sort((a, b) => b.donationsCount - a.donationsCount);
}

export default function AdminOrganizations() {
  const recipients = useRecipients();
  const donations = useDonations();
  const { setRecipientVerified } = useApp();
  const { run, isPending, isBusy } = useAction();

  const donors = donorOrgs(donations);
  const pendingCount = recipients.filter(r => !r.isVerified).length;

  const toggleVerification = (id: string, name: string, verified: boolean) =>
    run(id, () => setRecipientVerified(id, verified), {
      success: {
        message: verified ? `${name} verified` : `Verification withdrawn from ${name}`,
        subtitle: verified
          ? 'It can now accept donations and appears in match rankings.'
          : 'It can no longer accept donations.',
      },
      errorTitle: 'Could not change verification',
    });

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Partner Organizations Directory</h1>
        <p className="text-gray-500 mt-1">
          Verification is what lets a kitchen accept food. Unverified organisations can sign in and
          browse, but are left out of match rankings entirely.
        </p>
      </div>

      {/* Recipient NGOs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="section-title flex items-center gap-2">
            <Heart size={18} className="text-rose-500" />
            Recipient NGOs &amp; Community Kitchens ({recipients.length})
          </h2>
          {pendingCount > 0 && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              {pendingCount} awaiting verification
            </span>
          )}
        </div>

        {recipients.length === 0 ? (
          <div className="card p-8 text-center text-gray-500 text-sm">
            No recipient organisations have registered yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipients.map(ngo => (
              <div key={ngo.id} className="card p-5 space-y-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    {ngo.type}
                  </span>
                  {ngo.isVerified ? (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <ShieldCheck size={14} /> Verified
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700">Pending</span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 text-base">{ngo.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={12} /> {ngo.location}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-xl text-center text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">CAPACITY</span>
                    <span className="font-bold text-gray-900">{ngo.capacity}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">RELIABILITY</span>
                    <span className="font-bold text-emerald-600">{ngo.reliabilityScore}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">ACCEPTED</span>
                    <span className="font-bold text-gray-900">{ngo.acceptedDonations}</span>
                  </div>
                </div>

                <div className="text-xs text-gray-600 border-t border-gray-100 pt-2 flex items-center justify-between gap-2">
                  <span className="truncate">
                    Contact: <strong>{ngo.contactPerson}</strong>
                  </span>
                  <span className="text-gray-400 shrink-0">{ngo.phone}</span>
                </div>

                <button
                  type="button"
                  id={`btn-verify-${ngo.id}`}
                  onClick={() => toggleVerification(ngo.id, ngo.name, !ngo.isVerified)}
                  disabled={isBusy}
                  className={`w-full text-xs font-semibold py-2 rounded-lg border transition-colors disabled:opacity-60 ${
                    ngo.isVerified
                      ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {isPending(ngo.id) ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 size={13} className="animate-spin" /> Saving…
                    </span>
                  ) : ngo.isVerified ? (
                    'Withdraw verification'
                  ) : (
                    'Verify this organisation'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contributing donors */}
      <div className="space-y-4">
        <h2 className="section-title flex items-center gap-2">
          <Building2 size={18} className="text-emerald-600" />
          Contributing Food Donors ({donors.length})
        </h2>

        {donors.length === 0 ? (
          <div className="card p-8 text-center text-gray-500 text-sm">
            No donations have been posted yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {donors.map(donor => (
              <div key={donor.name} className="card p-5 space-y-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Food Donor
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={14} /> Active
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 text-base">{donor.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={12} /> {donor.locations[0]}
                    {donor.locations.length > 1 && ` +${donor.locations.length - 1} more`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-xl text-center text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">DONATIONS</span>
                    <span className="font-bold text-gray-900">{donor.donationsCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">MEALS DELIVERED</span>
                    <span className="font-bold text-emerald-700">
                      {donor.mealsContributed.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-600 border-t border-gray-100 pt-2">
                  Contact: <strong>{donor.contactPerson}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
