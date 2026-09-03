import { useEffect, useState } from 'react';
import { Mail, Phone, MapPin, ShieldCheck, Save, Navigation, Bike } from 'lucide-react';
import { useApp, useMyVolunteer } from '../../context/AppContext';
import { useAuth, useCurrentUser } from '../../context/AuthContext';
import { useAction } from '../../lib/hooks';
import { api } from '../../lib/api';
import PasswordCard from '../../components/PasswordCard';

export default function VolunteerProfile() {
  const user = useCurrentUser();
  const me = useMyVolunteer();
  const { updateProfile } = useAuth();
  const { refresh } = useApp();
  const { run, isBusy } = useAction();

  const [profile, setProfile] = useState({
    name: user.name,
    email: user.email,
    phone: '',
    location: '',
    // Transport and radius are not modelled server-side yet, so they are
    // local notes. Nothing reads them, and there is no dispatcher to read them.
    vehicleType: '',
    maxDistanceKm: 6,
    isAvailable: true,
  });

  useEffect(() => {
    if (!me) return;
    setProfile(prev => ({
      ...prev,
      phone: me.phone === '—' ? '' : me.phone,
      location: me.location === 'Location not set' ? '' : me.location,
      isAvailable: me.isAvailable,
    }));
  }, [me]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    return run(
      'profile',
      async () => {
        await updateProfile({ name: profile.name.trim(), phone: profile.phone.trim() || undefined });
        await api.updateMyVolunteer({
          isAvailable: profile.isAvailable,
          location: profile.location.trim(),
        });
        await refresh();
      },
      {
        success: {
          message: 'Courier profile saved',
          subtitle: profile.isAvailable
            ? 'Organisations see you as on duty.'
            : 'Organisations see you as off duty. Open pickups are still yours to claim.',
        },
        errorTitle: 'Could not save your profile',
      },
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Volunteer Courier Profile</h1>
        <p className="text-gray-500 mt-1">Manage transport mode, active radius, and duty status.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 text-blue-800 rounded-2xl flex items-center justify-center font-extrabold text-lg">
                {user.avatarInitials}
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{profile.name}</h2>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  <ShieldCheck size={12} /> {me ? `${me.completedDeliveries} runs · ${me.rating.toFixed(1)}★` : 'Community courier'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                profile.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
              }`}>
                {profile.isAvailable ? '● Available for Tasks' : '○ Offline'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={e => setProfile({ ...profile, name: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={profile.email}
                  readOnly
                  title="Your sign-in address. An administrator can change it."
                  className="input-field pl-9 bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={e => setProfile({ ...profile, phone: e.target.value })}
                  className="input-field pl-9"
                />
              </div>
            </div>
            <div>
              <label className="label">Mode of Transport</label>
              <div className="relative">
                <Bike size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={profile.vehicleType}
                  onChange={e => setProfile({ ...profile, vehicleType: e.target.value })}
                  className="input-field pl-9"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Primary Starting Hub</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={profile.location}
                  onChange={e => setProfile({ ...profile, location: e.target.value })}
                  className="input-field pl-9"
                />
              </div>
            </div>
            <div>
              <label className="label">Max Travel Radius (km)</label>
              <div className="relative">
                <Navigation size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  value={profile.maxDistanceKm}
                  onChange={e => setProfile({ ...profile, maxDistanceKm: Number(e.target.value) })}
                  className="input-field pl-9"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.isAvailable}
                onChange={e => setProfile({ ...profile, isAvailable: e.target.checked })}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <span className="font-medium">On duty — show me as available on the courier roster</span>
            </label>
          </div>
        </div>

        <button type="submit" className="btn-primary disabled:opacity-60" disabled={isBusy}>
          <Save size={16} /> {isBusy ? 'Saving…' : 'Save Volunteer Profile'}
        </button>
      </form>

      <PasswordCard />
    </div>
  );
}
