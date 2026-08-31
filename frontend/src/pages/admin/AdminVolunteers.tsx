import { Users, ShieldCheck, Star, Truck, MapPin, CheckCircle, Clock } from 'lucide-react';
import { MOCK_VOLUNTEERS } from '../../data/mockData';

export default function AdminVolunteers() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Volunteer Courier Fleet</h1>
        <p className="text-gray-500 mt-1">Manage courier status, track dispatch ratings, and monitor delivery efficiency.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {MOCK_VOLUNTEERS.map(v => (
          <div key={v.id} className="card p-5 space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                v.isAvailable
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}>
                {v.isAvailable ? '● On Duty' : '○ Off Duty'}
              </span>
              <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                <Star size={13} className="fill-amber-400 text-amber-500" /> {v.rating}
              </span>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 text-base">{v.name}</h3>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPin size={12} /> {v.location}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-xl text-center text-xs">
              <div>
                <span className="text-gray-400 block text-[10px]">COMPLETED</span>
                <span className="font-bold text-gray-900">{v.completedDeliveries}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">ACTIVE TRIPS</span>
                <span className="font-bold text-blue-600">{v.activeDeliveries}</span>
              </div>
            </div>

            <div className="text-xs text-gray-600 border-t border-gray-100 pt-2 flex items-center justify-between">
              <span>{v.phone}</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-0.5 text-[11px]">
                <ShieldCheck size={13} /> Verified Courier
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
