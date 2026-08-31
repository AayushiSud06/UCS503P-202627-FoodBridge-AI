import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart2, Package } from 'lucide-react';
import { useDonations, useRequirements } from '../context/AppContext';
import { MOCK_RECIPIENTS } from '../data/mockData';
import { deadlineStatus, URGENCY_STYLES } from '../lib/time';
import { MHero, MStatGrid, MSection, MEmpty } from './parts';

const RECIPIENT = MOCK_RECIPIENTS[0];

export default function NGOHome() {
  const navigate = useNavigate();
  const donations = useDonations();
  const requirements = useRequirements();

  const available = donations.filter(d => d.status === 'AVAILABLE' || d.status === 'MATCHED');
  const mine = donations.filter(d => d.recipientId === RECIPIENT.id);
  const inbound = mine.filter(d =>
    ['ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP'].includes(d.status)
  );
  const received = mine.filter(d => d.status === 'COMPLETED');
  const mealsReceived = received.reduce((s, d) => s + d.quantity, 0);

  const topMatches = [...available].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0)).slice(0, 3);
  const standing = requirements[0];

  return (
    <>
      <MHero
        label="Meals received"
        value={mealsReceived}
        sub={
          available.length > 0
            ? `${available.length} donation${available.length === 1 ? '' : 's'} available near you right now.`
            : 'No surplus listed nearby at the moment.'
        }
      />

      <MStatGrid
        items={[
          { label: 'Available', value: available.length },
          { label: 'Inbound', value: inbound.length },
          { label: 'Completed', value: received.length },
          { label: 'Capacity', value: RECIPIENT.capacity },
        ]}
      />

      <MSection
        title="Best matches now"
        action={
          <button
            type="button"
            onClick={() => navigate('/m/ngo/available')}
            className="text-xs font-medium text-emerald-700"
          >
            See all
          </button>
        }
      />

      {topMatches.length === 0 ? (
        <MEmpty
          icon={Package}
          title="Nothing available"
          hint="New surplus appears here as soon as a kitchen posts it."
        />
      ) : (
        topMatches.map(d => {
          const deadline = deadlineStatus(d.pickupDeadline);
          const urgency = URGENCY_STYLES[deadline.urgency];
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => navigate('/m/ngo/available')}
              className="w-full text-left flex items-center gap-4 px-5 py-3.5 bg-white border-b border-gray-100 active:bg-gray-50"
            >
              <span className="shrink-0 font-display font-semibold text-2xl text-emerald-700">
                {d.matchScore ?? '–'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-gray-900 truncate">{d.foodName}</span>
                <span className="block text-xs text-gray-500 truncate">
                  {d.quantity} {d.unit} · {d.donorOrganization}
                </span>
              </span>
              <span className={`text-xs font-medium shrink-0 ${urgency.text}`}>{deadline.label}</span>
            </button>
          );
        })
      )}

      {standing && (
        <>
          <MSection
            title="Your standing requirement"
            action={
              <button
                type="button"
                onClick={() => navigate('/m/ngo/requirements')}
                className="text-xs font-medium text-emerald-700"
              >
                Manage
              </button>
            }
          />
          <div className="mx-5 mb-2 rounded-2xl border border-gray-200 bg-white p-4">
            <p className="font-medium text-gray-900">
              {standing.quantityNeeded} {standing.unit} of {standing.foodType}
            </p>
            <p className="mt-1 text-sm text-gray-500 leading-relaxed">
              Feeds {standing.beneficiaryCount} people · {standing.urgency.toLowerCase()} urgency
              {standing.dailyRecurring ? ' · recurring daily' : ''}. Listings matching this are
              ranked for you first.
            </p>
          </div>
        </>
      )}

      <div className="p-5">
        <button type="button" className="m-btn-secondary" onClick={() => navigate('/m/ngo/impact')}>
          <BarChart2 size={16} />
          View intake impact
          <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}
