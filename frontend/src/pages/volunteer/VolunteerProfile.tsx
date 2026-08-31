import { useState } from 'react';
import { User, Mail, Phone, MapPin, ShieldCheck, Save, Navigation, Bike } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function VolunteerProfile() {
  const { showToast } = useApp();
  const [profile, setProfile] = useState({
    name: 'Aarav Sharma',
    email: 'aarav@thapar.edu',
    phone: '+91-98001-23456',
    location: 'Thapar University Campus, Patiala',
    vehicleType: 'Bicycle / EV Scooter',
    maxDistanceKm: 6,
    isAvailable: true,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('success', 'Volunteer Settings Saved', 'Your courier availability and vehicle preferences have been updated.');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Volunteer Courier Profile</h1>
        <p className="text-gray-500 mt-1">Manage transport mode, active radius, and dispatch availability.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 text-blue-800 rounded-2xl flex items-center justify-center font-extrabold text-lg">
                AS
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{profile.name}</h2>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  <ShieldCheck size={12} /> Verified Community Courier
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
                  onChange={e => setProfile({ ...profile, email: e.target.value })}
                  className="input-field pl-9"
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
              <span className="font-medium">Active & ready to receive new pickup dispatch alerts</span>
            </label>
          </div>
        </div>

        <button type="submit" className="btn-primary">
          <Save size={16} /> Save Volunteer Profile
        </button>
      </form>
    </div>
  );
}
