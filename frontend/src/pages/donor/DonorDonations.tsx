import { Package, Filter } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import DonationCard from '../../components/DonationCard';
import EmptyState from '../../components/EmptyState';
import { useDonations } from '../../context/AppContext';
import type { DonationStatus } from '../../types';

const FILTERS: { label: string; value: DonationStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Available', value: 'AVAILABLE' },
  { label: 'Matched', value: 'MATCHED' },
  { label: 'Accepted', value: 'ACCEPTED' },
  { label: 'In Transit', value: 'PICKED_UP' },
  { label: 'Completed', value: 'COMPLETED' },
];

export default function DonorDonations() {
  const donations = useDonations();
  const [filter, setFilter] = useState<DonationStatus | 'ALL'>('ALL');

  const myDonations = donations.filter(d => d.donorId === 'u-donor-1');
  const filtered = filter === 'ALL'
    ? myDonations
    : myDonations.filter(d => d.status === filter);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Donations</h1>
          <p className="text-gray-500 mt-1">{myDonations.length} total donations</p>
        </div>
        <Link to="/donor/create" className="btn-primary shrink-0">+ Create Donation</Link>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={16} className="text-gray-400" />
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f.value
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No donations found"
          description={filter === 'ALL' ? 'Create your first donation to get started.' : `No donations with status "${filter}".`}
          action={filter === 'ALL' ? (
            <Link to="/donor/create" className="btn-primary">+ Create Donation</Link>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(d => (
            <DonationCard
              key={d.id}
              donation={d}
              viewAs="donor"
              detailPath={`/donor/donations/${d.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
