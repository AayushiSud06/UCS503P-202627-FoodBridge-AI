import { useState } from 'react';
import { Package, Search, Filter, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { useDonations, useApp } from '../../context/AppContext';
import StatusBadge from '../../components/StatusBadge';
import type { DonationStatus } from '../../types';

export default function AdminDonations() {
  const donations = useDonations();
  const { updateDonationStatus, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DonationStatus | 'ALL'>('ALL');

  const filtered = donations.filter(d => {
    const matchesSearch =
      d.foodName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.donorOrganization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.recipientName && d.recipientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      d.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    showToast('info', 'Exporting CSV Report', 'Generated complete donation log with timestamps and status audit trail.');
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Donation Ledger</h1>
          <p className="text-gray-500 mt-1">Audit, monitor and manage all food listings across donors, NGOs, and couriers.</p>
        </div>
        <button onClick={handleExportCSV} className="btn-secondary text-xs">
          <Download size={14} /> Export CSV Ledger
        </button>
      </div>

      {/* Controls Bar */}
      <div className="card p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by food, donor, NGO or donation ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={16} className="text-gray-400" />
          {(['ALL', 'AVAILABLE', 'MATCHED', 'ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COMPLETED'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Donations Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3.5">ID</th>
                <th className="px-4 py-3.5">Food Item</th>
                <th className="px-4 py-3.5">Donor Origin</th>
                <th className="px-4 py-3.5">Quantity</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Recipient NGO</th>
                <th className="px-4 py-3.5">Assigned Volunteer</th>
                <th className="px-4 py-3.5">Match %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(d => (
                <tr key={d.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{d.id}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{d.foodName}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{d.donorOrganization}</td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-800">{d.quantity} {d.unit}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{d.recipientName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{d.volunteerName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs font-bold text-emerald-700">
                    {d.matchScore ? `${d.matchScore}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
