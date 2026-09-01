import { useNavigate } from 'react-router-dom';
import { Plus, Package } from 'lucide-react';
import { useDonations } from '../context/AppContext';
import { byUrgency } from '../lib/time';
import { useCurrentUser } from '../context/AuthContext';
import { MHero, MStatGrid, MSection, MDonationRow, MEmpty } from './parts';

const CLOSED = ['COMPLETED', 'CANCELLED'];

export default function DonorHome() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const mine = useDonations().filter(d => d.donorId === user.id);

  const active = mine
    .filter(d => !CLOSED.includes(d.status))
    .sort((a, b) => byUrgency(a.pickupDeadline, b.pickupDeadline));
  const completed = mine.filter(d => d.status === 'COMPLETED');
  const redistributed = completed.reduce((s, d) => s + d.quantity, 0);
  const awaiting = mine.filter(d => d.status === 'AVAILABLE' || d.status === 'MATCHED');
  const kitchens = new Set(mine.map(d => d.recipientName).filter(Boolean)).size;

  return (
    <>
      <MHero
        label="Meals redistributed"
        value={redistributed}
        sub={
          active.length > 0
            ? `${active.length} donation${active.length === 1 ? '' : 's'} still moving. The most urgent is listed first below.`
            : 'Nothing live right now. List surplus and a kitchen is matched within minutes.'
        }
      />

      <MStatGrid
        items={[
          { label: 'Active', value: active.length },
          { label: 'Awaiting pickup', value: awaiting.length },
          { label: 'Completed', value: completed.length },
          { label: 'Kitchens served', value: kitchens },
        ]}
      />

      <MSection
        title="Needs attention"
        action={
          <button
            type="button"
            onClick={() => navigate('/m/donor/listings')}
            className="text-xs font-medium text-emerald-700"
          >
            View all
          </button>
        }
      />

      {active.length === 0 ? (
        <MEmpty
          icon={Package}
          title="No live donations"
          hint="Surplus you list appears here until a kitchen has collected it."
        />
      ) : (
        active.map(d => (
          <MDonationRow
            key={d.id}
            donation={d}
            subtitle={d.recipientName ? `To ${d.recipientName}` : 'Awaiting a kitchen'}
            onClick={() => navigate('/m/donor/listings')}
          />
        ))
      )}

      <div className="p-5">
        <button type="button" className="m-btn-primary" onClick={() => navigate('/m/donor/create')}>
          <Plus size={18} />
          List surplus food
        </button>
      </div>
    </>
  );
}
