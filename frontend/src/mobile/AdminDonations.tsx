import { useState } from 'react';
import { Package } from 'lucide-react';
import { useDonations } from '../context/AppContext';
import { byUrgency } from '../lib/time';
import { MDonationRow, MEmpty, MSegmented } from './parts';

const FILTERS = ['All', 'Live', 'Completed', 'Cancelled'] as const;
const CLOSED = ['COMPLETED', 'CANCELLED'];

export default function AdminDonations() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const donations = useDonations();

  const rows = donations
    .filter(d => {
      if (filter === 'Live') return !CLOSED.includes(d.status);
      if (filter === 'Completed') return d.status === 'COMPLETED';
      if (filter === 'Cancelled') return d.status === 'CANCELLED';
      return true;
    })
    .sort((a, b) => byUrgency(a.pickupDeadline, b.pickupDeadline));

  return (
    <>
      <MSegmented options={FILTERS} value={filter} onChange={setFilter} />

      <p className="px-5 py-2.5 text-xs text-gray-500 bg-white border-b border-gray-200">
        Showing {rows.length} of {donations.length} donations
      </p>

      {rows.length === 0 ? (
        <MEmpty icon={Package} title="Nothing to show" hint="No donations match this filter." />
      ) : (
        rows.map(d => (
          <MDonationRow
            key={d.id}
            donation={d}
            subtitle={`${d.donorOrganization} → ${d.recipientName ?? 'unmatched'}`}
          />
        ))
      )}
      <div className="h-4" />
    </>
  );
}
