import { Building2, ShieldCheck, MapPin, Users, Heart, CheckCircle2 } from 'lucide-react';
import { MOCK_RECIPIENTS } from '../../data/mockData';

const DONOR_ORGS = [
  {
    id: 'd-1',
    name: 'College Central Mess',
    type: 'University Institutional Dining',
    location: 'Thapar University Campus',
    contactPerson: 'Aayushi Sharma',
    phone: '+91-98765-11223',
    donationsCount: 42,
    mealsContributed: 2150,
    status: 'Verified Active',
  },
  {
    id: 'd-2',
    name: 'Grand Orchid Banquets',
    type: 'Commercial Event Venue',
    location: 'VIP Road, Zirakpur',
    contactPerson: 'Vikram Mehta',
    phone: '+91-98111-22334',
    donationsCount: 28,
    mealsContributed: 1840,
    status: 'Verified Active',
  },
  {
    id: 'd-3',
    name: 'Campus Bakery & Patisserie',
    type: 'Commercial Food Outlet',
    location: 'Block A, Thapar Campus',
    contactPerson: 'Harish Bajaj',
    phone: '+91-97222-33445',
    donationsCount: 19,
    mealsContributed: 680,
    status: 'Verified Active',
  },
];

export default function AdminOrganizations() {
  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Partner Organizations Directory</h1>
        <p className="text-gray-500 mt-1">Verified partner network connecting institutional donors with community recipients.</p>
      </div>

      {/* Recipient NGOs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2">
            <Heart size={18} className="text-rose-500" />
            Verified Recipient NGOs & Community Kitchens ({MOCK_RECIPIENTS.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MOCK_RECIPIENTS.map(ngo => (
            <div key={ngo.id} className="card p-5 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  {ngo.type}
                </span>
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <ShieldCheck size={14} /> Verified
                </span>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 text-base">{ngo.name}</h3>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin size={12} /> {ngo.location}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-xl text-center text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px]">CAPACITY</span>
                  <span className="font-bold text-gray-900">{ngo.capacity}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">RELIABILITY</span>
                  <span className="font-bold text-emerald-600">{ngo.reliabilityScore}%</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">DELIVERIES</span>
                  <span className="font-bold text-gray-900">{ngo.acceptedDonations}</span>
                </div>
              </div>

              <div className="text-xs text-gray-600 border-t border-gray-100 pt-2 flex items-center justify-between">
                <span>Contact: <strong>{ngo.contactPerson}</strong></span>
                <span className="text-gray-400">{ngo.phone}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Institutional Donors */}
      <div className="space-y-4">
        <h2 className="section-title flex items-center gap-2">
          <Building2 size={18} className="text-emerald-600" />
          Registered Food Donors ({DONOR_ORGS.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DONOR_ORGS.map(donor => (
            <div key={donor.id} className="card p-5 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {donor.type}
                </span>
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 size={14} /> Active
                </span>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 text-base">{donor.name}</h3>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin size={12} /> {donor.location}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-xl text-center text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px]">DONATIONS</span>
                  <span className="font-bold text-gray-900">{donor.donationsCount}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">MEALS CONTRIBUTED</span>
                  <span className="font-bold text-emerald-700">{donor.mealsContributed.toLocaleString()}</span>
                </div>
              </div>

              <div className="text-xs text-gray-600 border-t border-gray-100 pt-2 flex items-center justify-between">
                <span>Contact: <strong>{donor.contactPerson}</strong></span>
                <span className="text-gray-400">{donor.phone}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
