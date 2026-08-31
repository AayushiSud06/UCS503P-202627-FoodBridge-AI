import { useState } from 'react';
import { Building2, Mail, Phone, MapPin, ShieldCheck, Save, Users, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function NGOProfile() {
  const { showToast } = useApp();
  const [profile, setProfile] = useState({
    name: 'Raj Malhotra',
    email: 'raj@helpinghands.org',
    organization: 'Helping Hands Community Kitchen',
    phone: '+91-98765-43210',
    location: 'Sector 38, Chandigarh',
    capacity: 150,
    operatingHours: '08:00 AM - 10:00 PM',
    verified: true,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('success', 'NGO Profile Saved', 'Capacity and contact details updated for matching algorithms.');
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
                HH
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{profile.organization}</h2>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  <ShieldCheck size={12} /> Registered Feeding Partner
                </span>
              </div>
            </div>
            <span className="text-xs text-gray-400 font-mono">ID: r-1</span>
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

        <button type="submit" className="btn-primary">
          <Save size={16} /> Save Profile
        </button>
      </form>
    </div>
  );
}
