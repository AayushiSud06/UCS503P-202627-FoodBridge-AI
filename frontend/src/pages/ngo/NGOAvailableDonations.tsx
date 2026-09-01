import { useState } from 'react';
import { Package, AlertCircle } from 'lucide-react';
import { useApp, useDonations, useMyRecipient } from '../../context/AppContext';
import { useCurrentUser } from '../../context/AuthContext';
import { useAction, useMatchAnalysis } from '../../lib/hooks';
import type { Donation } from '../../types';
import DonationCard from '../../components/DonationCard';
import EmptyState from '../../components/EmptyState';
import MatchAnalysisPanel from '../../components/MatchAnalysis';
import StatusTimeline from '../../components/StatusTimeline';

export default function NGOAvailableDonations() {
  const donations = useDonations();
  const { updateDonationStatus } = useApp();
  const user = useCurrentUser();
  const myRecipient = useMyRecipient();
  const { run, isPending, isBusy } = useAction();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const available = donations.filter(d => ['AVAILABLE', 'MATCHED'].includes(d.status));
  const selectedDonation = donations.find(d => d.id === selectedId);

  // Scores come from the server's ranker, against this account's own kitchen.
  const { analysis, recipientName, isLoading: analysisLoading } = useMatchAnalysis(
    selectedId,
    user.role === 'ngo' ? user.entityId : undefined,
  );

  // An unverified organisation may browse but cannot take custody; saying so
  // up front beats letting them click and collect a 403.
  const awaitingVerification = myRecipient !== null && myRecipient.isVerified === false;

  const handleAccept = async (donation: Donation) => {
    const accepted = await run(
      donation.id,
      // The server resolves which organisation an NGO is acting for; only an
      // administrator standing in for one has to name it.
      () => updateDonationStatus(donation.id, 'ACCEPTED', { recipientId: user.entityId }),
      {
        success: {
          message: 'Donation accepted',
          subtitle: 'It is yours to collect — a courier can now claim the pickup.',
        },
        errorTitle: 'Could not accept this donation',
      },
    );
    if (accepted) setSelectedId(null);
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Available Donations</h1>
        <p className="text-gray-500 mt-1">{available.length} donation{available.length !== 1 ? 's' : ''} available for pickup</p>
      </div>

      {awaitingVerification && (
        <div className="card p-4 flex items-start gap-2.5 border-amber-200 bg-amber-50">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Awaiting verification</p>
            <p className="text-xs text-amber-800 mt-0.5">
              An administrator has to vouch for {myRecipient?.name} before it can accept
              donations. You can browse in the meantime.
            </p>
          </div>
        </div>
      )}

      {available.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No available donations"
          description="No food donations match your location right now. Check back soon."
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-1 space-y-3">
            {available.map(d => (
              <div
                key={d.id}
                onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
                className={`cursor-pointer transition-all ${selectedId === d.id ? 'ring-2 ring-emerald-400 rounded-xl' : ''}`}
              >
                <DonationCard
                  donation={d}
                  viewAs="ngo"
                  onAction={awaitingVerification ? undefined : handleAccept}
                  actionLabel={isPending(d.id) ? 'Accepting…' : 'Accept Donation'}
                />
              </div>
            ))}
          </div>

          {/* Detail / Analysis panel */}
          <div className="lg:col-span-2 space-y-4">
            {selectedDonation ? (
              <>
                {analysisLoading ? (
                  <div className="card p-12 text-center text-gray-400">
                    <span className="inline-block w-5 h-5 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-sm mt-3">Scoring this donation…</p>
                  </div>
                ) : analysis ? (
                  <MatchAnalysisPanel
                    analysis={analysis}
                    recipientName={recipientName}
                    foodName={selectedDonation.foodName}
                    quantity={selectedDonation.quantity}
                    unit={selectedDonation.unit}
                  />
                ) : (
                  <div className="card p-6 text-center text-gray-500">
                    <p className="text-sm">
                      No verified organisation is close enough to this pickup to be scored.
                    </p>
                  </div>
                )}

                {/* Action */}
                {selectedDonation.status === 'MATCHED' || selectedDonation.status === 'AVAILABLE' ? (
                  <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-semibold text-gray-900">Ready to accept?</p>
                      <p className="text-sm text-gray-500">
                        You'll receive {selectedDonation.quantity} {selectedDonation.unit} of {selectedDonation.foodName}.
                      </p>
                    </div>
                    <button
                      id="btn-accept-donation"
                      onClick={() => handleAccept(selectedDonation)}
                      disabled={isBusy || awaitingVerification}
                      className="btn-primary disabled:opacity-60"
                    >
                      {isPending(selectedDonation.id) ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Accepting…
                        </span>
                      ) : (
                        'Accept Donation'
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="card p-4 bg-emerald-50 border-emerald-200">
                    <p className="text-sm font-medium text-emerald-700">
                      ✓ You have already accepted this donation.
                    </p>
                  </div>
                )}

                <div className="card p-5">
                  <h3 className="section-title mb-4">Donation Timeline</h3>
                  <StatusTimeline donation={selectedDonation} />
                </div>
              </>
            ) : (
              <div className="card p-12 text-center text-gray-400">
                <Package size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a donation to see the AI match analysis</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
