import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';
import { useStats, useActivity, useDonations } from '../context/AppContext';
import { MHero, MStatGrid, MSection, MEmpty } from './parts';

const CLOSED = ['COMPLETED', 'CANCELLED'];

export default function AdminHome() {
  const navigate = useNavigate();
  const stats = useStats();
  const activity = useActivity();
  const donations = useDonations();

  const live = donations.filter(d => !CLOSED.includes(d.status));
  const completionRate = stats.totalDonations
    ? Math.round((stats.completedDonations / stats.totalDonations) * 100)
    : 0;

  const ago = (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  };

  return (
    <>
      <MHero
        label="Meals redistributed"
        value={stats.totalMeals.toLocaleString()}
        sub={`${live.length} donation${live.length === 1 ? '' : 's'} moving through the platform right now.`}
      />

      <MStatGrid
        items={[
          { label: 'Donations', value: stats.totalDonations },
          { label: 'Completed', value: stats.completedDonations },
          { label: 'Organisations', value: stats.totalOrganizations },
          { label: 'Couriers', value: stats.totalVolunteers },
        ]}
      />

      <div className="px-5 py-4 bg-white border-b border-gray-200">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-700">Completion rate</span>
          <span className="font-display font-semibold text-gray-900">{completionRate}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-700"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {stats.successfulPickups} successful pickups against {stats.totalDonations} listings.
        </p>
      </div>

      <MSection
        title="Recent activity"
        action={
          <button
            type="button"
            onClick={() => navigate('/m/admin/donations')}
            className="text-xs font-medium text-emerald-700"
          >
            All donations
          </button>
        }
      />

      {activity.length === 0 ? (
        <MEmpty icon={Activity} title="No activity yet" hint="Platform events appear here as they happen." />
      ) : (
        activity.slice(0, 8).map(a => (
          <div key={a.id} className="flex gap-3 px-5 py-3 bg-white border-b border-gray-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-700 leading-relaxed">{a.message}</p>
              <p className="mt-0.5 text-xs text-gray-400">{ago(a.timestamp)}</p>
            </div>
          </div>
        ))
      )}

      <div className="p-5">
        <button type="button" className="m-btn-secondary" onClick={() => navigate('/m/admin/analytics')}>
          Open analytics
          <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}
