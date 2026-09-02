import { useState } from 'react';
import {
  PlusCircle, ClipboardList, AlertCircle, Users, Check, Clock, Pencil, CheckCircle2,
} from 'lucide-react';
import { useRequirements, useApp, useMyRecipient } from '../../context/AppContext';
import { useAction } from '../../lib/hooks';
import type { NGORequirement } from '../../types';

const BLANK_FORM = {
  foodType: '',
  quantityNeeded: '',
  unit: 'Meals',
  beneficiaryCount: '',
  urgency: 'High' as 'High' | 'Medium' | 'Low',
  dailyRecurring: true,
  notes: '',
};

export default function NGORequirements() {
  const allRequirements = useRequirements();
  const { createRequirement, updateRequirement, retireRequirement } = useApp();
  const myRecipient = useMyRecipient();
  const { run, isBusy, isPending } = useAction();
  const [showModal, setShowModal] = useState(false);
  // Null while posting something new; the requirement being revised otherwise.
  // The same modal serves both, so an edit is a filled-in version of the form
  // that posted it.
  const [editing, setEditing] = useState<NGORequirement | null>(null);

  // Every kitchen posts to the same board; this page is about your own needs.
  const requirements = myRecipient
    ? allRequirements.filter(r => r.ngoId === myRecipient.id)
    : allRequirements;

  const [form, setForm] = useState(BLANK_FORM);

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(BLANK_FORM);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK_FORM);
    setShowModal(true);
  };

  const openEdit = (req: NGORequirement) => {
    setEditing(req);
    setForm({
      foodType: req.foodType,
      quantityNeeded: String(req.quantityNeeded),
      unit: req.unit,
      beneficiaryCount: String(req.beneficiaryCount),
      urgency: req.urgency,
      dailyRecurring: req.dailyRecurring,
      notes: req.notes,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.foodType || !form.quantityNeeded) return;

    const draft = {
      foodType: form.foodType,
      quantityNeeded: Number(form.quantityNeeded),
      unit: form.unit,
      beneficiaryCount: Number(form.beneficiaryCount) || 0,
      urgency: form.urgency,
      dailyRecurring: form.dailyRecurring,
      notes: form.notes,
    };

    const saved = editing
      ? await run('save-requirement', () => updateRequirement(editing.id, draft), {
          success: {
            message: 'Requirement updated',
            subtitle: 'Donors now see the revised need.',
          },
          errorTitle: 'Could not update this requirement',
        })
      : await run('save-requirement', () => createRequirement(draft), {
          success: {
            message: 'Requirement posted',
            subtitle: 'Donors can now see what your kitchen needs.',
          },
          errorTitle: 'Could not post this requirement',
        });
    if (!saved) return;

    closeModal();
  };

  // Fulfilled and no-longer-needed are the same state on the server: the
  // requirement comes off the board and the record is kept. Nothing is deleted.
  const handleFulfil = (req: NGORequirement) =>
    run(`retire-${req.id}`, () => retireRequirement(req.id), {
      success: {
        message: 'Requirement closed',
        subtitle: 'It has left the board; the record is kept.',
      },
      errorTitle: 'Could not close this requirement',
    });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Food Requirements & Demand Signals</h1>
          <p className="text-gray-500 mt-1">
            Specify your kitchen's daily beneficiary needs so FoodLink AI prioritizes donations matching your requirements.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="btn-primary shrink-0"
        >
          <PlusCircle size={18} /> Post New Requirement
        </button>
      </div>

      {/* Active requirements list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {requirements.map((req) => (
          <div key={req.id} className="card p-5 space-y-3 relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                req.urgency === 'High'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : req.urgency === 'Medium'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {req.urgency} Priority
              </span>
              {req.dailyRecurring && (
                <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                  <Clock size={12} /> Daily Recurring
                </span>
              )}
            </div>

            <div>
              <h3 className="font-bold text-gray-900 text-base">{req.foodType}</h3>
              <p className="text-xs text-gray-500">{req.ngoName}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl text-xs">
              <div>
                <span className="text-gray-400 font-medium">TARGET QUANTITY</span>
                <p className="font-bold text-gray-900 text-sm mt-0.5">{req.quantityNeeded} {req.unit}</p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">BENEFICIARIES</span>
                <p className="font-bold text-gray-900 text-sm mt-0.5 flex items-center gap-1">
                  <Users size={14} className="text-emerald-600" /> ~{req.beneficiaryCount} people
                </p>
              </div>
            </div>

            {req.notes && (
              <p className="text-xs text-gray-600 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                💬 {req.notes}
              </p>
            )}

            <div className="pt-2 flex items-center justify-between text-xs text-emerald-700 font-semibold">
              <span className="flex items-center gap-1">
                <Check size={14} /> AI Scanning Active
              </span>
              <span className="text-gray-400 font-normal">Auto-matching enabled</span>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => openEdit(req)}
                disabled={isBusy}
                className="btn-secondary text-xs px-3.5 py-1.5 disabled:opacity-60"
              >
                <Pencil size={13} /> Edit
              </button>
              <button
                type="button"
                onClick={() => handleFulfil(req)}
                disabled={isBusy}
                className="btn-outline-primary text-xs px-3.5 py-1.5 disabled:opacity-60"
              >
                <CheckCircle2 size={13} />
                {isPending(`retire-${req.id}`) ? 'Closing…' : 'Mark fulfilled'}
              </button>
              <span className="ml-auto text-[11px] text-gray-400">
                Closing keeps the record
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for creating a new requirement */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6 space-y-4 bg-white shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">
              {editing ? 'Edit Food Requirement / Demand' : 'Post Food Requirement / Demand'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Food Type Needed *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cooked Lunch / Dal Rice / Bread"
                  value={form.foodType}
                  onChange={e => setForm({ ...form, foodType: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantity Needed *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="100"
                    value={form.quantityNeeded}
                    onChange={e => setForm({ ...form, quantityNeeded: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="input-field"
                  >
                    <option>Meals</option>
                    <option>Kg</option>
                    <option>Boxes</option>
                    <option>Pieces</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Estimated Beneficiaries</label>
                  <input
                    type="number"
                    placeholder="120"
                    value={form.beneficiaryCount}
                    onChange={e => setForm({ ...form, beneficiaryCount: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">Urgency Level</label>
                  <select
                    value={form.urgency}
                    onChange={e => setForm({ ...form, urgency: e.target.value as any })}
                    className="input-field"
                  >
                    <option value="High">High Urgency</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Notes / Dietary Requirements</label>
                <textarea
                  rows={2}
                  placeholder="Any storage constraints, timings, or packaging requirements"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="input-field resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={form.dailyRecurring}
                  onChange={e => setForm({ ...form, dailyRecurring: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="recurring" className="text-xs text-gray-700 cursor-pointer">
                  This is a daily recurring need
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="btn-primary text-xs disabled:opacity-60"
                >
                  {editing ? 'Save Changes' : 'Broadcast Requirement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
