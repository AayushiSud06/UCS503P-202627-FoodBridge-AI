import { useState } from 'react';
import {
  PlusCircle, ClipboardList, AlertCircle, Users, Check, Clock, Pencil, CheckCircle2,
  Archive, RotateCcw,
} from 'lucide-react';
import { useAllRequirements, useApp, useMyRecipient } from '../../context/AppContext';
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
  // This is the one screen that reads retired needs as well as active ones:
  // reopening a need (D-29) needs it listed first, and the server sends an
  // organisation its own history and nobody else's.
  const allRequirements = useAllRequirements();
  const {
    createRequirement, updateRequirement, retireRequirement, reopenRequirement,
  } = useApp();
  const myRecipient = useMyRecipient();
  const { run, isBusy, isPending } = useAction();
  const [showModal, setShowModal] = useState(false);
  // Null while posting something new; the requirement being revised otherwise.
  // The same modal serves both, so an edit is a filled-in version of the form
  // that posted it.
  const [editing, setEditing] = useState<NGORequirement | null>(null);

  // Every kitchen posts to the same board; this page is about your own needs.
  // The server already scopes the list to this organisation (D-44); the filter
  // stays as defence in depth rather than as the thing that makes it true.
  const requirements = myRecipient
    ? allRequirements.filter(r => r.ngoId === myRecipient.id)
    : allRequirements;

  const active = requirements.filter(r => r.isActive);
  const retired = requirements.filter(r => !r.isActive);

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
            subtitle: 'The revised need is on your board.',
          },
          errorTitle: 'Could not update this requirement',
        })
      : await run('save-requirement', () => createRequirement(draft), {
          success: {
            message: 'Requirement posted',
            subtitle: 'It is now on your demand board.',
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

  // The same flag, the other way round. Nothing was deleted when the need left
  // the board, so reopening restores the original row rather than posting a
  // copy of it.
  const handleReopen = (req: NGORequirement) =>
    run(`reopen-${req.id}`, () => reopenRequirement(req.id), {
      success: {
        message: 'Requirement reopened',
        subtitle: 'It is back on your demand board.',
      },
      errorTitle: 'Could not reopen this requirement',
    });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Food Requirements & Demand Signals</h1>
          <p className="text-gray-500 mt-1">
            Record what your kitchen needs and how many people it feeds. Requirements are a
            standing record of demand — they are not yet an input to donation matching, which
            ranks on distance, quantity, capacity, pickup window and reliability.
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
        {active.map(req => (
          <RequirementCard
            key={req.id}
            req={req}
            isBusy={isBusy}
            isPending={isPending}
            onEdit={openEdit}
            onRetire={handleFulfil}
            onReopen={handleReopen}
          />
        ))}
      </div>

      {/* Retired requirements. Kept rather than deleted (D-29), so this is the
          record of what this kitchen has asked for before — and the only place
          a retired need can be put back on the board. */}
      {retired.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Archive size={17} className="text-gray-400" /> Retired requirements
            </h2>
            <p className="text-xs text-gray-500">
              {retired.length} {retired.length === 1 ? 'need is' : 'needs are'} off the demand
              board. Nothing was deleted — reopen one to make it visible again.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {retired.map(req => (
              <RequirementCard
                key={req.id}
                req={req}
                isBusy={isBusy}
                isPending={isPending}
                onEdit={openEdit}
                onRetire={handleFulfil}
                onReopen={handleReopen}
              />
            ))}
          </div>
        </section>
      )}

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

/**
 * One standing need, active or retired.
 *
 * The two states are the same record and the same fields — `is_active` is the
 * only lifecycle the server keeps (D-29) — so they are the same card, and what
 * differs is what it says about itself and what it offers to do next. A retired
 * card is visibly set back, states that it is off the board, and carries the one
 * action that applies to it.
 */
function RequirementCard({
  req, isBusy, isPending, onEdit, onRetire, onReopen,
}: {
  req: NGORequirement;
  isBusy: boolean;
  isPending: (key: string) => boolean;
  onEdit: (req: NGORequirement) => void;
  onRetire: (req: NGORequirement) => void;
  onReopen: (req: NGORequirement) => void;
}) {
  const retired = !req.isActive;

  return (
    <div
      className={`card p-5 space-y-3 relative overflow-hidden ${
        retired ? 'bg-gray-50/70 border-dashed' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {retired ? (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-300 flex items-center gap-1">
            <Archive size={11} /> Retired
          </span>
        ) : (
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
            req.urgency === 'High'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : req.urgency === 'Medium'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {req.urgency} Priority
          </span>
        )}
        {req.dailyRecurring && (
          <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
            <Clock size={12} /> Needed daily
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

      {retired ? (
        <div className="pt-2 flex items-center gap-1 text-xs text-gray-500 font-semibold">
          <Archive size={14} /> Off the demand board
          <span className="text-gray-400 font-normal">
            — {req.urgency.toLowerCase()} priority when it was open
          </span>
        </div>
      ) : (
        <div className="pt-2 flex items-center gap-1 text-xs text-emerald-700 font-semibold">
          <Check size={14} /> Active on the demand board
          <span className="text-gray-400 font-normal">— retire it once the need is met</span>
        </div>
      )}

      <div className="pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
        {retired ? (
          <>
            <button
              type="button"
              onClick={() => onReopen(req)}
              disabled={isBusy}
              className="btn-outline-primary text-xs px-3.5 py-1.5 disabled:opacity-60"
            >
              <RotateCcw size={13} />
              {isPending(`reopen-${req.id}`) ? 'Reopening…' : 'Reopen'}
            </button>
            <span className="ml-auto text-[11px] text-gray-400">
              Reopening puts it back on the board
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onEdit(req)}
              disabled={isBusy}
              className="btn-secondary text-xs px-3.5 py-1.5 disabled:opacity-60"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              type="button"
              onClick={() => onRetire(req)}
              disabled={isBusy}
              className="btn-outline-primary text-xs px-3.5 py-1.5 disabled:opacity-60"
            >
              <CheckCircle2 size={13} />
              {isPending(`retire-${req.id}`) ? 'Closing…' : 'Mark fulfilled'}
            </button>
            <span className="ml-auto text-[11px] text-gray-400">
              Closing keeps the record
            </span>
          </>
        )}
      </div>
    </div>
  );
}
