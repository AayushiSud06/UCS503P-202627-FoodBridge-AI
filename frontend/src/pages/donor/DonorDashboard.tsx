import { Link } from 'react-router-dom';
import { PlusCircle, Package, CheckCircle, Truck, Clock } from 'lucide-react';
import StatCard from '../../components/StatCard';
import DonationCard from '../../components/DonationCard';
import EmptyState from '../../components/EmptyState';
import { useDonations, useStats } from '../../context/AppContext';

export default function DonorDashboard() {
  const donations = useDonations();
  const stats = useStats();

  const myDonations = donations.filter(d => d.donorId === 'u-donor-1');
  const recentDonations = myDonations.slice(0, 5);

  const activeDonations = myDonations.filter(d =>
    !['COMPLETED', 'CANCELLED'].includes(d.status)
  ).length;

  const completedDonations = myDonations.filter(d => d.status === 'COMPLETED').length;

  const totalMeals = myDonations.reduce((sum, d) => sum + d.quantity, 0);

  const completedMeals = myDonations
    .filter(d => d.status === 'COMPLETED')
    .reduce((sum, d) => sum + d.quantity, 0);

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, Aayushi 👋</h1>
          <p className="text-gray-500 mt-1">Here's what's happening with your food donations.</p>
        </div>
        <Link to="/donor/create" id="btn-create-donation" className="btn-primary shrink-0">
          <PlusCircle size={18} />
          Create Donation
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Meals Donated" value={totalMeals} icon={Package} color="emerald" />
        <StatCard label="Active Donations" value={activeDonations} icon={Clock} color="blue" trend={`${activeDonations} in progress`} />
        <StatCard label="Meals Redistributed" value={completedMeals + 96} icon={CheckCircle} color="purple" />
        <StatCard label="Completed Pickups" value={completedDonations + 12} icon={Truck} color="amber" />
      </div>

      {/* Recent Donations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Recent Donations</h2>
          <Link to="/donor/donations" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            View all →
          </Link>
        </div>

        {recentDonations.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No donations yet"
            description="Create your first food donation to get started."
            action={
              <Link to="/donor/create" className="btn-primary">
                <PlusCircle size={16} />
                Create Donation
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recentDonations.map(d => (
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

      {/* Quick CTA */}
      <div className="card p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-semibold text-gray-900">Have surplus food today?</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              List it now and we'll match it with a suitable recipient automatically.
            </p>
          </div>
          <Link to="/donor/create" className="btn-primary shrink-0">
            <PlusCircle size={18} />
            + Create Donation
          </Link>
        </div>
      </div>
    </div>
  );
}
