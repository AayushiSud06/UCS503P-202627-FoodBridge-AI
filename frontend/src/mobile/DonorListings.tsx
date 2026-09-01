import { useState } from 'react';
import { Package } from 'lucide-react';
import { useDonations } from '../context/AppContext';
import { byUrgency } from '../lib/time';
import { useCurrentUser } from '../context/AuthContext';
import { MDonationRow, MEmpty, MSegmented } from './parts';

const FILTERS = ['All', 'Live', 'Completed'] as const;
const CLOSED = ['COMPLETED', 'CANCELLED'];

export default function DonorListings() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const user = useCurrentUser();
  const mine = useDonations().filter(d => d.donorId === user.id);

  const rows = mine
    .filter(d => {
      if (filter === 'Live') return !CLOSED.includes(d.status);
      if (filter === 'Completed') return CLOSED.includes(d.status);
      return true;
    })
    .sort((a, b) => byUrgency(a.pickupDeadline, b.pickupDeadline));

  return (
    <>
      <MSegmented options={FILTERS} value={filter} onChange={setFilter} />

      {rows.length === 0 ? (
        <MEmpty
          icon={Package}
          title="Nothing here yet"
          hint={
            filter === 'Completed'
              ? 'Donations show up here once a kitchen confirms delivery.'
              : 'List surplus food and it will appear in this feed.'
          }
        />
      ) : (
        rows.map(d => (
          <MDonationRow
            key={d.id}
            donation={d}
            subtitle={d.recipientName ? `To ${d.recipientName} · ${d.category}` : `${d.category} · unmatched`}
          />
        ))
      )}
      <div className="h-4" />
    </>
  );
}
