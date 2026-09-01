import { useState } from 'react';
import { Search, Filter, Download, RefreshCw } from 'lucide-react';
import { useDonations, useApp } from '../../context/AppContext';
import { useAction } from '../../lib/hooks';
import { api } from '../../lib/api';
import { formatClock } from '../../lib/time';
import StatusBadge from '../../components/StatusBadge';
import type { Donation, DonationStatus } from '../../types';

/** CSV needs quotes doubled and the whole field wrapped once it contains one. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Donation[]): string {
  const header = [
    'id', 'food', 'category', 'quantity', 'unit', 'donor', 'donorOrganisation',
    'status', 'recipient', 'volunteer', 'matchScore', 'distanceKm',
    'createdAt', 'pickupDeadline', 'acceptedAt', 'deliveredAt', 'completedAt',
  ];
  const lines = rows.map(d =>
    [
      d.id, d.foodName, d.category, d.quantity, d.unit, d.donorName, d.donorOrganization,
      d.status, d.recipientName, d.volunteerName, d.matchScore, d.distanceKm,
      d.createdAt, d.pickupDeadline, d.acceptedAt, d.deliveredAt, d.completedAt,
    ].map(csvCell).join(','),
  );
  return [header.join(','), ...lines].join('\r\n');
}

export default function AdminDonations() {
  const donations = useDonations();
  const { showToast, refresh } = useApp();
  const { run, isPending } = useAction();
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
    // Built from what is on screen, so the export matches the filters applied.
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `foodlink-donations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Ledger exported', `${filtered.length} rows written to CSV.`);
  };

  // Unclaimed donations past their deadline have to reach a terminal state on
  // their own — the expiry-loss rate is a reported metric.
  const handleExpirySweep = () =>
    run(
      'expire',
      async () => {
        const result = await api.expireOverdue();
        await refresh();
        return result;
      },
      { errorTitle: 'Could not run the expiry sweep' },
    ).then(result => {
      if (!result) return;
      showToast(
        result.expired > 0 ? 'success' : 'info',
        result.expired > 0
          ? `${result.expired} donation${result.expired === 1 ? '' : 's'} expired`
          : 'Nothing to expire',
        result.expired > 0
          ? 'They passed their deadline with no recipient.'
          : 'Every open donation is still within its deadline.',
      );
    });

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Donation Ledger</h1>
          <p className="text-gray-500 mt-1">Audit, monitor and manage all food listings across donors, NGOs, and couriers.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExpirySweep}
            disabled={isPending('expire')}
            className="btn-secondary text-xs disabled:opacity-60"
            id="btn-expiry-sweep"
          >
            <RefreshCw size={14} className={isPending('expire') ? 'animate-spin' : ''} />
            {isPending('expire') ? 'Sweeping…' : 'Run expiry sweep'}
          </button>
          <button onClick={handleExportCSV} className="btn-secondary text-xs">
            <Download size={14} /> Export CSV Ledger
          </button>
        </div>
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
          {(['ALL', 'AVAILABLE', 'MATCHED', 'ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COMPLETED', 'EXPIRED', 'CANCELLED'] as const).map(st => (
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
                <th className="px-4 py-3.5">Deadline</th>
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
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {formatClock(d.pickupDeadline)}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-emerald-700">
                    {d.matchScore ? `${d.matchScore}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-gray-500">
              No donations match this filter.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
