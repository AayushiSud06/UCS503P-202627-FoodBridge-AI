import { useEffect, useState } from 'react';
import { Building2, Mail, Phone, MapPin, ShieldCheck, Save, Users, Clock } from 'lucide-react';
import { useApp, useMyRecipient } from '../../context/AppContext';
import { useAuth, useCurrentUser } from '../../context/AuthContext';
import { useAction } from '../../lib/hooks';
import { api } from '../../lib/api';
import PasswordCard from '../../components/PasswordCard';

export default function NGOProfile() {
  const user = useCurrentUser();
  const me = useMyRecipient();
  const { updateProfile } = useAuth();
  const { refresh } = useApp();
  const { run, isBusy } = useAction();

  const [profile, setProfile] = useState({
    name: user.name,
    email: user.email,
    organization: me?.name ?? user.organization ?? '',
    phone: me?.phone ?? '',
    location: me?.location ?? '',
    capacity: me?.capacity ?? 100,
    operatingHours: '',
  });

  // The organisation arrives a moment after the first render, so the form is
  // seeded from it when it lands rather than being stuck on empty defaults.
  useEffect(() => {
    if (!me) return;
    setProfile(prev => ({
      ...prev,
      organization: me.name,
      phone: me.phone === '—' ? '' : me.phone,
      location: me.location === 'Location not set' ? '' : me.location,
      capacity: me.capacity,
    }));
  }, [me]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    return run(
      'profile',
      async () => {
        // Two records: the account (who you are) and the organisation (what
        // the matcher scores). The kitchen's capacity and address belong to
        // the second, so they go to a different endpoint.
        await updateProfile({
          name: profile.name.trim(),
          organization: profile.organization.trim(),
        });
        await api.updateMyRecipient({
          name: profile.organization.trim(),
          location: profile.location.trim(),
          capacity: Number(profile.capacity) || 1,
          contactPerson: profile.name.trim(),
          phone: profile.phone.trim() || null,
        });
        await refresh();
      },
      {
        success: {
          message: 'Organisation saved',
          subtitle: 'Capacity and location now feed the match ranking.',
        },
        errorTitle: 'Could not save your organisation',
      },
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">NGO / Recipient Profile</h1>
        <p className="text-gray-500 mt-1">Configure kitchen capacity limits, intake coordinators, and receiving facility hours.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-rose-100 text-rose-800 rounded-2xl flex items-center justify-center font-extrabold text-lg">
                {user.avatarInitials}
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{profile.organization}</h2>
                {me?.isVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <ShieldCheck size={12} /> Verified recipient
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <Clock size={12} /> Awaiting verification
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-gray-400 font-mono">Org #{me?.id ?? '—'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Intake Coordinator Name</label>
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
              <label className="label">Max Batch Capacity (Meals)</label>
              <div className="relative">
                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  value={profile.capacity}
                  onChange={e => setProfile({ ...profile, capacity: Number(e.target.value) })}
                  className="input-field pl-9"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Facility Location</label>
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
        </div>

        <button type="submit" className="btn-primary disabled:opacity-60" disabled={isBusy}>
          <Save size={16} /> {isBusy ? 'Saving…' : 'Save Profile'}
        </button>
      </form>

      <PasswordCard />
    </div>
  );
}
