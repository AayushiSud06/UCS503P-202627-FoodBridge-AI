import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Package, User, Truck } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import StatusTimeline from '../../components/StatusTimeline';
import { useDonations } from '../../context/AppContext';

export default function DonationDetails() {
  const { id } = useParams<{ id: string }>();
  const donations = useDonations();
  const donation = donations.find(d => d.id === id);

  if (!donation) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Donation not found.</p>
        <Link to="/donor" className="btn-primary mt-4 inline-flex">← Back to Dashboard</Link>
      </div>
    );
  }

  const CATEGORY_EMOJI: Record<string, string> = {
    Vegetarian: '🥗', 'Non-Vegetarian': '🍗', Bakery: '🥖',
    'Fruits & Vegetables': '🍎', 'Packaged Food': '📦', Other: '🍽️',
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back */}
      <Link to="/donor/donations" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-600 transition-colors">
        <ArrowLeft size={16} />
        Back to Donations
      </Link>

      {/* Hero card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl shrink-0">
              {CATEGORY_EMOJI[donation.category] ?? '🍽️'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{donation.quantity} {donation.unit} of {donation.foodName}</h1>
              <p className="text-gray-500 text-sm mt-0.5">{donation.donorOrganization}</p>
            </div>
          </div>
          <StatusBadge status={donation.status} />
        </div>

        {donation.imagePreview && (
          <img
            src={donation.imagePreview}
            alt="Donated food"
            className="mt-4 w-full h-48 object-cover rounded-xl border border-gray-100"
          />
        )}

        {/* Details grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { icon: Package, label: 'Quantity', value: `${donation.quantity} ${donation.unit}` },
            { icon: Clock, label: 'Prepared', value: donation.preparedAt },
            { icon: Clock, label: 'Pickup Deadline', value: donation.pickupDeadline },
            { icon: MapPin, label: 'Location', value: donation.location },
            { icon: Package, label: 'Category', value: donation.category },
            { icon: Package, label: 'Storage', value: donation.storageType },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={14} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-500">{label}</span>
              </div>
              <p className="text-sm font-semibold text-gray-800">{value}</p>
            </div>
          ))}
        </div>

        {donation.description && (
          <div className="mt-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
            <p className="text-sm text-gray-700">{donation.description}</p>
          </div>
        )}

        {/* Match info */}
        {donation.recipientName && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-purple-50 border border-purple-100 rounded-xl">
            <User size={16} className="text-purple-500 shrink-0" />
            <div>
              <p className="text-xs font-medium text-purple-600">Matched Recipient</p>
              <p className="text-sm font-semibold text-gray-800">{donation.recipientName}</p>
            </div>
            {donation.matchScore !== undefined && (
              <span className="ml-auto text-sm font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded-lg">
                {donation.matchScore}% match
              </span>
            )}
          </div>
        )}

        {donation.volunteerName && (
          <div className="mt-2 flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <Truck size={16} className="text-blue-500 shrink-0" />
            <div>
              <p className="text-xs font-medium text-blue-600">Assigned Volunteer</p>
              <p className="text-sm font-semibold text-gray-800">{donation.volunteerName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="card p-6">
        <h2 className="section-title mb-5">Status Timeline</h2>
        <StatusTimeline donation={donation} />
      </div>
    </div>
  );
}
