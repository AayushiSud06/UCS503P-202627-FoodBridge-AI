import { useNavigate } from 'react-router-dom';
import { BarChart2, LogOut, Star } from 'lucide-react';
import { useApp, useMyVolunteer } from '../context/AppContext';
import { useAuth, useCurrentUser } from '../context/AuthContext';
import { useAction } from '../lib/hooks';
import { MSection, MDetail, MToggle } from './parts';

export default function VolunteerProfile() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const me = useMyVolunteer();
  const { setAvailability } = useApp();
  const { signOut } = useAuth();
  const { run, isBusy } = useAction();

  const available = me?.isAvailable ?? true;

  const toggleAvailability = () =>
    run('availability', () => setAvailability(!available), {
      success: {
        message: available ? 'Off duty' : 'On duty',
        subtitle: available
          ? 'Organisations now see you as off duty. Open pickups are still yours to claim.'
          : 'Organisations now see you as on duty.',
      },
      errorTitle: 'Could not change your availability',
    });

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <section className="flex items-center gap-4 px-5 py-5 bg-white border-b border-gray-200">
        <span className="w-14 h-14 shrink-0 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg font-bold">
          {user.avatarInitials}
        </span>
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-lg text-gray-900 truncate">{user.name}</h2>
          <p className="text-sm text-gray-500 truncate">{me?.location ?? 'Location not set'}</p>
          <span className="mt-1.5 m-chip bg-emerald-50 text-emerald-700">
            <Star size={12} />
            {(me?.rating ?? 5).toFixed(1)} · {me?.completedDeliveries ?? 0} runs
          </span>
        </div>
      </section>

      <MSection title="Availability" />
      <MToggle
        label={available ? 'Accepting pickups' : 'Not accepting pickups'}
        checked={available}
        onChange={isBusy ? () => {} : toggleAvailability}
      />

      <MSection title="Details" />
      <MDetail label="Email" value={user.email} />
      <MDetail label="Phone" value={me?.phone ?? '—'} />
      <MDetail label="Base location" value={me?.location ?? 'Not set'} />
      <MDetail label="Completed deliveries" value={me?.completedDeliveries ?? 0} />

      <div className="p-5 space-y-2.5">
        <button
          type="button"
          className="m-btn-secondary"
          onClick={() => navigate('/m/volunteer/impact')}
        >
          <BarChart2 size={16} />
          Courier impact
        </button>
        <button type="button" className="m-btn-secondary" onClick={handleSignOut}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );
}
