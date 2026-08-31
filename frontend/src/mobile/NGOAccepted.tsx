import { useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { useDonations, useApp } from '../context/AppContext';
import { MOCK_RECIPIENTS } from '../data/mockData';
import { byUrgency } from '../lib/time';
import { MDonationRow, MEmpty, MSegmented } from './parts';

const RECIPIENT = MOCK_RECIPIENTS[0];
const FILTERS = ['Inbound', 'Completed'] as const;
const INBOUND = ['ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED'];

export default function NGOAccepted() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Inbound');
  const { updateDonationStatus, showToast } = useApp();
  const mine = useDonations().filter(d => d.recipientId === RECIPIENT.id);

  const rows = mine
    .filter(d => (filter === 'Inbound' ? INBOUND.includes(d.status) : d.status === 'COMPLETED'))
    .sort((a, b) => byUrgency(a.pickupDeadline, b.pickupDeadline));

  const confirm = (id: string, quantity: number, unit: string) => {
    updateDonationStatus(id, 'COMPLETED');
    showToast('success', 'Receipt confirmed', `${quantity} ${unit} logged against your intake.`);
  };

  return (
    <>
      <MSegmented options={FILTERS} value={filter} onChange={setFilter} />

      {rows.length === 0 ? (
        <MEmpty
          icon={CheckSquare}
          title={filter === 'Inbound' ? 'Nothing inbound' : 'Nothing completed yet'}
          hint={
            filter === 'Inbound'
              ? 'Donations you accept appear here until they are delivered.'
              : 'Confirmed deliveries are recorded here.'
          }
        />
      ) : (
        rows.map(d => (
          <div key={d.id}>
            <MDonationRow
              donation={d}
              subtitle={`From ${d.donorOrganization}${d.volunteerName ? ` · ${d.volunteerName}` : ''}`}
            />
            {d.status === 'DELIVERED' && (
              <div className="px-5 py-3 bg-white border-b border-gray-100">
                <button
                  type="button"
                  className="m-btn-primary"
                  onClick={() => confirm(d.id, d.quantity, d.unit)}
                >
                  Confirm receipt
                </button>
              </div>
            )}
          </div>
        ))
      )}
      <div className="h-4" />
    </>
  );
}
