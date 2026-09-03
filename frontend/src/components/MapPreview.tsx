import { useState } from 'react';
import { MapPin, Building2, User, Compass, Info } from 'lucide-react';

/**
 * A schematic of the three points a handover passes through.
 *
 * It is **not** a map and **not** a route. FoodLink has no routing provider,
 * no geocoder and no map tiles (see `ARCHITECTURE.md` → *External services:
 * none*), and a courier's position is never read, stored or transmitted. The
 * only figure with anything behind it is `distanceKm` — the server's
 * great-circle distance between the donor's pin and the kitchen's — which is
 * why the legs carry no distances and the footer carries no travel estimate.
 * There is nothing honest to put in them.
 */
interface MapPreviewProps {
  pickupLocation: string;
  dropoffLocation: string;
  /** Server-provided straight-line distance. Absent until a recipient is bound. */
  distanceKm?: number;
  volunteerLocation?: string;
}

export default function MapPreview({
  pickupLocation,
  dropoffLocation,
  distanceKm,
  volunteerLocation = 'Courier not yet assigned',
}: MapPreviewProps) {
  const [activeTab, setActiveTab] = useState<'diagram' | 'details'>('diagram');

  return (
    <div className="card overflow-hidden border-emerald-100 shadow-sm">
      {/* Header */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">Handover Overview</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('diagram')}
            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
              activeTab === 'diagram' ? 'bg-emerald-700 text-white' : 'text-emerald-300 hover:bg-emerald-800/60'
            }`}
          >
            Diagram
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
              activeTab === 'details' ? 'bg-emerald-700 text-white' : 'text-emerald-300 hover:bg-emerald-800/60'
            }`}
          >
            Locations
          </button>
        </div>
      </div>

      {activeTab === 'diagram' ? (
        /* Schematic: the order the food moves in, not where anybody is */
        <div className="relative bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-6 sm:p-8 flex items-center justify-center min-h-[220px] overflow-hidden">
          {/* Decorative grid. Not a map, and not drawn from coordinates. */}
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

          {/* Connected points */}
          <div className="relative z-10 w-full max-w-lg flex items-center justify-between gap-2 sm:gap-4">
            {/* Donor Node */}
            <div className="flex flex-col items-center text-center">
              <div className="w-11 h-11 bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-900/50 backdrop-blur">
                <Building2 size={20} />
              </div>
              <span className="mt-2 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Pickup</span>
              <p className="text-xs font-semibold text-white max-w-[90px] truncate" title={pickupLocation}>
                {pickupLocation.split(',')[0]}
              </p>
            </div>

            {/* Connecting line. Deliberately unlabelled with a distance: the
                individual legs are never measured, only donor→kitchen is. */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full flex items-center">
                <div className="h-0.5 flex-1 bg-gradient-to-r from-emerald-500 to-sky-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-emerald-300/70 font-semibold mt-1">Collect</span>
            </div>

            {/* Volunteer Node */}
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-sky-500/20 border-2 border-sky-400 text-sky-300 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-900/50 backdrop-blur">
                <User size={22} />
              </div>
              <span className="mt-2 text-[10px] font-bold text-sky-400 uppercase tracking-wider">Courier</span>
              <p className="text-xs font-semibold text-white max-w-[100px] truncate" title={volunteerLocation}>
                {volunteerLocation}
              </p>
            </div>

            {/* Connecting line */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-full flex items-center">
                <div className="h-0.5 flex-1 bg-gradient-to-r from-sky-400 to-rose-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-sky-300/70 font-semibold mt-1">Deliver</span>
            </div>

            {/* Recipient Node */}
            <div className="flex flex-col items-center text-center">
              <div className="w-11 h-11 bg-rose-500/20 border-2 border-rose-400 text-rose-300 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-900/50 backdrop-blur">
                <MapPin size={20} />
              </div>
              <span className="mt-2 text-[10px] font-bold text-rose-400 uppercase tracking-wider">Drop-off</span>
              <p className="text-xs font-semibold text-white max-w-[90px] truncate" title={dropoffLocation}>
                {dropoffLocation.split(',')[0]}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* The three locations, spelled out */
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

      {/* Footer: the one real number, and what it is not. */}
      <div className="px-4 py-2.5 bg-emerald-50/50 border-t border-emerald-100 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-emerald-800">
          <Info size={13} className="text-emerald-600 shrink-0" />
          {typeof distanceKm === 'number' ? (
            <span>Straight-line distance: <strong>{distanceKm} km</strong></span>
          ) : (
            <span>Straight-line distance unavailable</span>
          )}
        </div>
        <span className="text-[11px] text-gray-500">
          Schematic only — no road route, travel time or courier location
        </span>
      </div>
    </div>
  );
}
