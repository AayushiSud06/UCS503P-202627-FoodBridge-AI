import { Link } from 'react-router-dom';
import { Package, CheckSquare, Heart, Truck } from 'lucide-react';
import StatCard from '../../components/StatCard';
import DonationCard from '../../components/DonationCard';
import EmptyState from '../../components/EmptyState';
import { useDonations } from '../../context/AppContext';

export default function NGODashboard() {
  const donations = useDonations();

  const available = donations.filter(d => ['AVAILABLE', 'MATCHED'].includes(d.status));
  const accepted = donations.filter(d => ['ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP'].includes(d.status) && d.recipientId === 'r-1');
  const completed = donations.filter(d => d.status === 'COMPLETED' && d.recipientId === 'r-1');

  const mealsReceived = completed.reduce((s, d) => s + d.quantity, 0) + 184;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, Helping Hands 👋</h1>
          <p className="text-gray-500 mt-1">Food available for your community kitchen today.</p>
        </div>
        <Link to="/ngo/available" className="btn-primary shrink-0">
          <Package size={18} /> Browse Available Food
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Available Matches" value={available.length} icon={Package} color="emerald" trend="Updated just now" />
        <StatCard label="Accepted" value={accepted.length + 5} icon={CheckSquare} color="blue" />
        <StatCard label="Meals Received" value={mealsReceived} icon={Heart} color="rose" />
        <StatCard label="Successful Pickups" value={completed.length + 23} icon={Truck} color="purple" />
      </div>

      {/* Available donations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Available Donations</h2>
          <Link to="/ngo/available" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View all →</Link>
        </div>

        {available.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No matches available"
            description="No suitable food donations are available right now. Check back soon!"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {available.slice(0, 3).map(d => (
              <DonationCard
                key={d.id}
                donation={d}
                viewAs="ngo"
                detailPath={`/ngo/available/${d.id}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Accepted donations */}
      {accepted.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Active Accepted Donations</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {accepted.map(d => (
              <DonationCard key={d.id} donation={d} viewAs="ngo" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
