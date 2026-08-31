import { Link } from 'react-router-dom';
import { Truck, CheckCircle, Package, Navigation } from 'lucide-react';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import { useDonations } from '../../context/AppContext';
import TaskCard from './TaskCard';

export default function VolunteerDashboard() {
  const donations = useDonations();

  // Tasks assigned to this volunteer (v-1) or newly accepted (ACCEPTED state, no volunteer yet)
  const myTasks = donations.filter(d =>
    (d.volunteerId === 'v-1' || d.status === 'ACCEPTED') &&
    !['COMPLETED', 'CANCELLED', 'AVAILABLE', 'MATCHED'].includes(d.status)
  );

  const completedTasks = donations.filter(d => d.volunteerId === 'v-1' && d.status === 'COMPLETED');
  const mealsMoved = completedTasks.reduce((s, d) => s + d.quantity, 0) + 42;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, Aarav 👋</h1>
          <p className="text-gray-500 mt-1">Your active pickup tasks and delivery history.</p>
        </div>
        <Link to="/volunteer/tasks" className="btn-primary shrink-0">
          <Truck size={18} /> View All Tasks
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Completed Pickups" value={completedTasks.length + 8} icon={CheckCircle} color="emerald" />
        <StatCard label="Meals Delivered" value={mealsMoved} icon={Package} color="blue" />
        <StatCard label="Active Tasks" value={myTasks.length} icon={Truck} color="amber" trend={myTasks.length > 0 ? 'Action needed' : 'All clear!'} />
        <StatCard label="Distance Covered" value="12 km" icon={Navigation} color="purple" />
      </div>

      {/* Active tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Active Tasks</h2>
          <Link to="/volunteer/tasks" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View all →</Link>
        </div>

        {myTasks.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="You're all caught up!"
            description="No active pickup tasks. New tasks will appear when you accept them."
          />
        ) : (
          <div className="space-y-4">
            {myTasks.map(d => <TaskCard key={d.id} donation={d} />)}
          </div>
        )}
      </div>
    </div>
  );
}
