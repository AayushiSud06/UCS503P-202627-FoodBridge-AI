import { useState } from 'react';
import { Package } from 'lucide-react';
import { useDonations, useApp } from '../../context/AppContext';
import type { Donation } from '../../types';
import DonationCard from '../../components/DonationCard';
import EmptyState from '../../components/EmptyState';
import MatchAnalysisPanel from '../../components/MatchAnalysis';
import StatusTimeline from '../../components/StatusTimeline';
import { computeMockMatchScore, MOCK_RECIPIENTS } from '../../data/mockData';

export default function NGOAvailableDonations() {
  const donations = useDonations();
  const { updateDonationStatus, showToast } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);

  const available = donations.filter(d => ['AVAILABLE', 'MATCHED'].includes(d.status));
  const selectedDonation = donations.find(d => d.id === selectedId);

  const handleAccept = (donation: Donation) => {
    setAccepting(donation.id);
    setTimeout(() => {
      updateDonationStatus(donation.id, 'ACCEPTED', {
        recipientId: 'r-1',
        recipientName: 'Helping Hands Community Kitchen',
        matchScore: donation.matchScore ?? 94,
        distanceKm: donation.distanceKm ?? 1.8,
      });
      showToast('success', 'Donation accepted!', 'A volunteer will be assigned shortly.');
      setAccepting(null);
      setSelectedId(null);
    }, 700);
  };

  // Compute analysis for selected donation
  const getAnalysis = (donation: Donation) => {
    const recipient = MOCK_RECIPIENTS[0];
    return computeMockMatchScore(
      donation.quantity,
      recipient.capacity,
      donation.distanceKm ?? recipient.distanceKm,
      recipient.reliabilityScore,
    );
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Available Donations</h1>
        <p className="text-gray-500 mt-1">{available.length} donation{available.length !== 1 ? 's' : ''} available for pickup</p>
      </div>

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
                  onAction={handleAccept}
                  actionLabel={accepting === d.id ? 'Accepting…' : 'Accept Donation'}
                />
              </div>
            ))}
          </div>

          {/* Detail / Analysis panel */}
          <div className="lg:col-span-2 space-y-4">
            {selectedDonation ? (
              <>
                <MatchAnalysisPanel
                  analysis={getAnalysis(selectedDonation)}
                  recipientName="Helping Hands Community Kitchen"
                />

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
                      disabled={accepting === selectedDonation.id}
                      className="btn-primary"
                    >
                      {accepting === selectedDonation.id ? (
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
