import { useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { useDonations, useApp } from '../context/AppContext';
import { useCurrentUser } from '../context/AuthContext';
import { useAction } from '../lib/hooks';
import { byUrgency } from '../lib/time';
import { MDonationRow, MEmpty, MSegmented } from './parts';

const FILTERS = ['Inbound', 'Completed'] as const;
const INBOUND = ['ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED'];

export default function NGOAccepted() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Inbound');
  const { updateDonationStatus } = useApp();
  const user = useCurrentUser();
  const { run, isPending, isBusy } = useAction();
  const mine = useDonations().filter(d => d.recipientId === user.entityId);

  const rows = mine
    .filter(d => (filter === 'Inbound' ? INBOUND.includes(d.status) : d.status === 'COMPLETED'))
    .sort((a, b) => byUrgency(a.pickupDeadline, b.pickupDeadline));

  const confirm = (id: string, quantity: number, unit: string) =>
    run(id, () => updateDonationStatus(id, 'COMPLETED'), {
      success: {
        message: 'Receipt confirmed',
        subtitle: `${quantity} ${unit} logged against your intake.`,
      },
      errorTitle: 'Could not confirm receipt',
    });

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
                  className="m-btn-primary disabled:opacity-60"
                  disabled={isBusy}
                  onClick={() => confirm(d.id, d.quantity, d.unit)}
                >
                  {isPending(d.id) ? 'Confirming…' : 'Confirm receipt'}
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
