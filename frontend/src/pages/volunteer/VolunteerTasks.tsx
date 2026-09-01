import { Truck } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { useDonations } from '../../context/AppContext';
import { useCurrentUser } from '../../context/AuthContext';
import TaskCard from './TaskCard';

export default function VolunteerTasks() {
  const donations = useDonations();
  const user = useCurrentUser();

  // Show all tasks that are active (ACCEPTED, VOLUNTEER_ASSIGNED, PICKED_UP)
  const activeTasks = donations.filter(d =>
    ['ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP'].includes(d.status)
  );

  const completedTasks = donations.filter(d =>
    d.status === 'COMPLETED' && d.volunteerId === user.entityId
  );

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pickup Tasks</h1>
        <p className="text-gray-500 mt-1">{activeTasks.length} active task{activeTasks.length !== 1 ? 's' : ''}</p>
      </div>

      {activeTasks.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="You're all caught up!"
          description="No pickup tasks available right now. Accept a task from the NGO dashboard to get started."
        />
      ) : (
        <div className="space-y-4">
          <h2 className="section-title">Active</h2>
          {activeTasks.map(d => (
            <TaskCard key={d.id} donation={d} />
          ))}
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="space-y-4">
          <h2 className="section-title text-gray-500">Recently Completed</h2>
          {completedTasks.map(d => (
            <TaskCard key={d.id} donation={d} />
          ))}
        </div>
      )}
    </div>
  );
}
