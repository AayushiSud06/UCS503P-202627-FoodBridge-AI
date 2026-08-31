import { useState } from 'react';
import { MapPin, Navigation, Building2, User, Compass, Info, Check } from 'lucide-react';

interface MapPreviewProps {
  pickupLocation: string;
  dropoffLocation: string;
  distanceKm: number;
  volunteerLocation?: string;
  currentStage?: 'pickup' | 'transit' | 'delivered';
}

export default function MapPreview({
  pickupLocation,
  dropoffLocation,
  distanceKm,
  volunteerLocation = 'Aarav Sharma (0.8 km away)',
  currentStage = 'pickup',
}: MapPreviewProps) {
  const [activeTab, setActiveTab] = useState<'route' | 'details'>('route');

  return (
    <div className="card overflow-hidden border-emerald-100 shadow-sm">
      {/* Map Header */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-emerald-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">Redistribution Route Corridor</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('route')}
            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
              activeTab === 'route' ? 'bg-emerald-700 text-white' : 'text-emerald-300 hover:bg-emerald-800/60'
            }`}
          >
            Route Map
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
              activeTab === 'details' ? 'bg-emerald-700 text-white' : 'text-emerald-300 hover:bg-emerald-800/60'
            }`}
          >
            Waypoints
          </button>
        </div>
      </div>

      {activeTab === 'route' ? (
        /* Visual Map Canvas */
        <div className="relative bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-6 sm:p-8 flex items-center justify-center min-h-[220px] overflow-hidden">
          {/* Animated GPS Grid Pattern */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: `
                radial-gradient(circle at 1px 1px, rgba(52, 211, 153, 0.4) 1px, transparent 0),
                linear-gradient(to right, rgba(16, 185, 129, 0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(16, 185, 129, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '24px 24px, 48px 48px, 48px 48px',
            }}
          />

          {/* Connected Waypoints Flow */}
          <div className="relative z-10 w-full max-w-lg flex items-center justify-between gap-2 sm:gap-4">
            {/* Donor Node */}
            <div className="flex flex-col items-center text-center">
              <div className="w-11 h-11 bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/50 backdrop-blur">
                <Building2 size={20} />
              </div>
              <span className="mt-2 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Origin</span>
              <p className="text-xs font-semibold text-white max-w-[90px] truncate" title={pickupLocation}>
                {pickupLocation.split(',')[0]}
              </p>
            </div>

            {/* Connecting Line 1 */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full flex items-center">
                <div className="h-0.5 flex-1 bg-gradient-to-r from-emerald-500 to-sky-400 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-300 rounded-full animate-ping" />
                </div>
              </div>
              <span className="text-[10px] text-emerald-300 font-mono mt-1">~0.8 km</span>
            </div>

            {/* Volunteer Node */}
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-sky-500/20 border-2 border-sky-400 text-sky-300 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-900/50 backdrop-blur relative">
                <User size={22} />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-sky-400 rounded-full border-2 border-slate-900 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 bg-white rounded-full" />
                </span>
              </div>
              <span className="mt-2 text-[10px] font-bold text-sky-400 uppercase tracking-wider">Volunteer</span>
              <p className="text-xs font-semibold text-white max-w-[100px] truncate">
                {volunteerLocation.split('(')[0]}
              </p>
            </div>

            {/* Connecting Line 2 */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full flex items-center">
                <div className="h-0.5 flex-1 bg-gradient-to-r from-sky-400 to-rose-400 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-rose-300 rounded-full animate-ping" />
                </div>
              </div>
              <span className="text-[10px] text-sky-300 font-mono mt-1">~{(distanceKm - 0.8 > 0 ? (distanceKm - 0.8).toFixed(1) : 1.0)} km</span>
            </div>

            {/* Recipient Node */}
            <div className="flex flex-col items-center text-center">
              <div className="w-11 h-11 bg-rose-500/20 border-2 border-rose-400 text-rose-300 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-900/50 backdrop-blur">
                <MapPin size={20} />
              </div>
              <span className="mt-2 text-[10px] font-bold text-rose-400 uppercase tracking-wider">Destination</span>
              <p className="text-xs font-semibold text-white max-w-[90px] truncate" title={dropoffLocation}>
                {dropoffLocation.split(',')[0]}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Detailed Waypoints List */
        <div className="p-4 bg-gray-50 divide-y divide-gray-200 text-xs">
          <div className="py-2.5 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
              1
            </div>
            <div>
              <p className="font-semibold text-gray-900">Pickup Location (Donor)</p>
              <p className="text-gray-600">{pickupLocation}</p>
            </div>
          </div>
          <div className="py-2.5 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
              2
            </div>
            <div>
              <p className="font-semibold text-gray-900">Assigned Courier</p>
              <p className="text-gray-600">{volunteerLocation}</p>
            </div>
          </div>
          <div className="py-2.5 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0">
              3
            </div>
            <div>
              <p className="font-semibold text-gray-900">Dropoff Location (Recipient)</p>
              <p className="text-gray-600">{dropoffLocation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="px-4 py-2.5 bg-emerald-50/50 border-t border-emerald-100 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-emerald-800">
          <Info size={13} className="text-emerald-600 shrink-0" />
          <span>Total Corridor Distance: <strong>{distanceKm} km</strong> · Estimated Travel: <strong>~{Math.round(distanceKm * 6 + 10)} mins</strong></span>
        </div>
        <span className="text-[11px] text-gray-500">Live GPS tracking active in Phase 2</span>
      </div>
    </div>
  );
}
