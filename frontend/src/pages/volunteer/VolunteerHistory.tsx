import { History, CheckCircle, Package, MapPin, Clock, ExternalLink } from 'lucide-react';
import { useDonations } from '../../context/AppContext';
import { useCurrentUser } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import { formatDistanceKm } from '../../lib/geo';
import EmptyState from '../../components/EmptyState';

export default function VolunteerHistory() {
  const donations = useDonations();
  const user = useCurrentUser();
  const completed = donations.filter(d =>
    d.status === 'COMPLETED' && d.volunteerId === user.entityId
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Delivery History & Completed Missions</h1>
        <p className="text-gray-500 mt-1">Full log of all successfully completed surplus food pickups and deliveries.</p>
      </div>

      {completed.length === 0 ? (
        <EmptyState
          icon={History}
          title="No completed deliveries yet"
          description="Accept active pickup tasks to build your courier track record."
        />
      ) : (
        <div className="space-y-4">
          {completed.map(d => (
            <div key={d.id} className="card p-5 hover:border-gray-300 transition-all">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                    ✓
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{d.quantity} {d.unit} of {d.foodName}</h3>
                    <p className="text-xs text-gray-500">{d.donorOrganization} → {d.recipientName ?? 'recipient'}</p>
                  </div>
                </div>
                <StatusBadge status={d.status} size="sm" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl text-xs text-gray-600">
                <div>
                  <span className="text-gray-400 block text-[11px]">PICKUP LOCATION</span>
                  <span className="font-medium truncate block">{d.location}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">STRAIGHT-LINE DISTANCE</span>
                  <span className="font-medium">
                    {formatDistanceKm(d, 'Unavailable')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">CATEGORY</span>
                  <span className="font-medium">{d.category}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">DELIVERED AT</span>
                  <span className="font-medium">
                    {d.deliveredAt ? new Date(d.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Verified Delivery'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
