import { useState } from 'react';
import { Mail, Phone, MapPin, Clock, ShieldCheck, Check, Save } from 'lucide-react';
import { useCurrentUser, useAuth } from '../../context/AuthContext';
import { useAction } from '../../lib/hooks';
import PasswordCard from '../../components/PasswordCard';

export default function DonorProfile() {
  const user = useCurrentUser();
  const { updateProfile } = useAuth();
  const { run, isBusy } = useAction();

  // Name, organisation and phone are stored on the account. The rest are
  // local preferences the API does not model yet — kept, but not pretended
  // to be saved anywhere.
  const [profile, setProfile] = useState({
    name: user.name,
    email: user.email,
    organization: user.organization ?? '',
    phone: '',
    location: '',
    operatingHours: '',
    notificationEmail: true,
    notificationSMS: true,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    return run(
      'profile',
      () =>
        updateProfile({
          name: profile.name.trim(),
          organization: profile.organization.trim(),
          phone: profile.phone.trim() || undefined,
        }),
      {
        success: { message: 'Profile saved', subtitle: 'Your contact details have been updated.' },
        errorTitle: 'Could not save your profile',
      },
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Donor Profile & Settings</h1>
        <p className="text-gray-500 mt-1">Manage institutional details, kitchen safety badges, and pickup locations.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Organization Card */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center font-extrabold text-lg">
                {user.avatarInitials}
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{profile.organization || user.name}</h2>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck size={12} /> Verified Institutional Donor
                </span>
              </div>
            </div>
            <span className="text-xs text-gray-400 font-mono">Account #{user.id}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Primary Contact Person</label>
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
              <label className="label">Operating Hours</label>
              <div className="relative">
                <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={profile.operatingHours}
                  onChange={e => setProfile({ ...profile, operatingHours: e.target.value })}
                  className="input-field pl-9"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Default Pickup Address</label>
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

        {/* Safety & Compliance */}
        <div className="card p-6 space-y-4">
          <h2 className="section-title border-b border-gray-100 pb-3">Food Safety & Quality Compliance</h2>
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
            <Check size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <p className="font-bold text-sm text-emerald-950 mb-1">FSSAI Hygiene Standards Compliant</p>
              This kitchen conforms to safe surplus handling protocols: food is stored at recommended temperatures, labeled with preparation times, and packaged in food-grade containers.
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.notificationEmail}
                onChange={e => setProfile({ ...profile, notificationEmail: e.target.checked })}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <span>Send me real-time email updates when an NGO accepts a donation</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.notificationSMS}
                onChange={e => setProfile({ ...profile, notificationSMS: e.target.checked })}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <span>Send SMS alerts when a volunteer arrives for food pickup</span>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary disabled:opacity-60" disabled={isBusy}>
            <Save size={16} /> {isBusy ? 'Saving…' : 'Save Profile Settings'}
          </button>
        </div>
      </form>

      <PasswordCard />
    </div>
  );
}
