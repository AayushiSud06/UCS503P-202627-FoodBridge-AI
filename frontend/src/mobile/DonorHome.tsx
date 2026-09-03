import { useNavigate } from 'react-router-dom';
import { Plus, Package } from 'lucide-react';
import { useDonations } from '../context/AppContext';
import { byUrgency } from '../lib/time';
import { useCurrentUser } from '../context/AuthContext';
import { MHero, MStatGrid, MSection, MDonationRow, MEmpty } from './parts';
import { donorImpact } from '../lib/impact';

const CLOSED = ['COMPLETED', 'CANCELLED'];

export default function DonorHome() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const donations = useDonations();
  const mine = donations.filter(d => d.donorId === user.id);
  // Shared with the Impact screen so "redistributed" and "kitchens served"
  // cannot mean one thing here and another there.
  const impact = donorImpact(donations, user.id);

  const active = mine
    .filter(d => !CLOSED.includes(d.status))
    .sort((a, b) => byUrgency(a.pickupDeadline, b.pickupDeadline));
  const awaiting = mine.filter(d => d.status === 'AVAILABLE' || d.status === 'MATCHED');

  return (
    <>
      <MHero
        label="Meals redistributed"
        value={impact.deliveredMeals}
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
          { label: 'Completed', value: impact.deliveredCount },
          { label: 'Kitchens served', value: impact.kitchens.length },
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
