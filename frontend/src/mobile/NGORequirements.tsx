import { useState } from 'react';
import { CheckCircle2, ClipboardList, Pencil, Plus, X } from 'lucide-react';
import { useRequirements, useApp, useMyRecipient } from '../context/AppContext';
import { useAction } from '../lib/hooks';
import type { NGORequirement } from '../types';
import { MEmpty, MSection } from './parts';

const URGENCIES: NGORequirement['urgency'][] = ['High', 'Medium', 'Low'];

const URGENCY_CHIP: Record<NGORequirement['urgency'], string> = {
  High: 'bg-clay-50 text-clay-700',
  Medium: 'bg-amber-50 text-amber-700',
  Low: 'bg-gray-100 text-gray-600',
};

export default function NGORequirements() {
  const requirements = useRequirements();
  const { createRequirement, updateRequirement, retireRequirement } = useApp();
  const myRecipient = useMyRecipient();
  const { run, isBusy, isPending } = useAction();
  const [open, setOpen] = useState(false);
  // Null while posting something new; the requirement being revised otherwise.
  const [editing, setEditing] = useState<NGORequirement | null>(null);

  const [foodType, setFoodType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [beneficiaries, setBeneficiaries] = useState('');
  const [urgency, setUrgency] = useState<NGORequirement['urgency']>('High');
  const [recurring, setRecurring] = useState(true);
  const [notes, setNotes] = useState('');

  const mine = myRecipient
    ? requirements.filter(r => r.ngoId === myRecipient.id)
    : requirements;
  const valid = foodType.trim() !== '' && Number(quantity) > 0;

  const reset = () => {
    setEditing(null);
    setFoodType('');
    setQuantity('');
    setBeneficiaries('');
    setUrgency('High');
    setRecurring(true);
    setNotes('');
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (r: NGORequirement) => {
    setEditing(r);
    setFoodType(r.foodType);
    setQuantity(String(r.quantityNeeded));
    setBeneficiaries(String(r.beneficiaryCount));
    setUrgency(r.urgency);
    setRecurring(r.dailyRecurring);
    setNotes(r.notes);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;

    const draft = {
      foodType: foodType.trim(),
      quantityNeeded: Number(quantity),
      unit: editing?.unit ?? 'Meals',
      beneficiaryCount: Number(beneficiaries) || 0,
      urgency,
      dailyRecurring: recurring,
      notes: notes.trim(),
    };

    const saved = editing
      ? await run('save-requirement', () => updateRequirement(editing.id, draft), {
          success: { message: 'Requirement updated', subtitle: 'Donors see the revised need.' },
          errorTitle: 'Could not update this requirement',
        })
      : await run('save-requirement', () => createRequirement(draft), {
          success: { message: 'Requirement posted', subtitle: 'Donors can now see what you need.' },
          errorTitle: 'Could not post this requirement',
        });
    if (!saved) return;

    close();
  };

  // Met or no longer needed are one state on the server: off the board, record
  // kept. Nothing is deleted.
  const fulfil = (r: NGORequirement) =>
    run(`retire-${r.id}`, () => retireRequirement(r.id), {
      success: { message: 'Requirement closed', subtitle: 'Off the board; the record is kept.' },
      errorTitle: 'Could not close this requirement',
    });

  return (
    <>
      <p className="px-5 py-3.5 text-sm text-gray-500 leading-relaxed bg-white border-b border-gray-200">
        Posting what you need lets the platform rank incoming surplus against your demand before
        you even open the app.
      </p>

      {mine.length === 0 ? (
        <MEmpty
          icon={ClipboardList}
          title="No requirements posted"
          hint="Tell donors what you need and matching donations are pushed to you first."
        />
      ) : (
        <>
          <MSection title={`Posted (${mine.length})`} />
          {mine.map(r => (
            <article key={r.id} className="px-5 py-4 bg-white border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-gray-900 leading-snug">
                    {r.quantityNeeded} {r.unit} · {r.foodType}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Feeds {r.beneficiaryCount}
                    {r.dailyRecurring ? ' · recurring daily' : ' · one-off'}
                  </p>
                </div>
                <span className={`m-chip shrink-0 ${URGENCY_CHIP[r.urgency]}`}>{r.urgency}</span>
              </div>
              {r.notes && <p className="mt-2 text-sm text-gray-600 leading-relaxed">{r.notes}</p>}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  disabled={isBusy}
                  className="m-btn-secondary flex-1 text-xs"
                  style={{ minHeight: '2.5rem' }}
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => fulfil(r)}
                  disabled={isBusy}
                  className="m-btn-secondary flex-1 text-xs"
                  style={{ minHeight: '2.5rem' }}
                >
                  <CheckCircle2 size={14} />
                  {isPending(`retire-${r.id}`) ? 'Closing…' : 'Mark fulfilled'}
                </button>
              </div>
            </article>
          ))}
        </>
      )}

      <div className="h-24" />

      <button type="button" className="m-fab" onClick={openCreate} aria-label="Post requirement">
        <Plus size={26} />
      </button>

      {open && (
        <>
          <button type="button" className="m-backdrop" onClick={close} aria-label="Close" />
          <form className="m-sheet" onSubmit={submit}>
            <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-gray-200">
              <h2 className="font-display font-semibold text-lg text-gray-900">
                {editing ? 'Edit requirement' : 'Post a requirement'}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="w-9 h-9 shrink-0 rounded-full border border-gray-300 text-gray-500 flex items-center justify-center active:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <label className="block">
                <span className="label">What do you need?</span>
                <input
                  className="m-input"
                  value={foodType}
                  onChange={e => setFoodType(e.target.value)}
                  placeholder="Hot vegetarian meals"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label">Quantity (meals)</span>
                  <input
                    className="m-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    placeholder="120"
                  />
                </label>
                <label className="block">
                  <span className="label">Beneficiaries</span>
                  <input
                    className="m-input"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={beneficiaries}
                    onChange={e => setBeneficiaries(e.target.value)}
                    placeholder="140"
                  />
                </label>
              </div>

              <div>
                <span className="label">Urgency</span>
                <div className="flex gap-2">
                  {URGENCIES.map(u => (
                    <button
                      key={u}
                      type="button"
                      aria-pressed={urgency === u}
                      onClick={() => setUrgency(u)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        urgency === u
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-gray-600 border-gray-300'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={recurring}
                onClick={() => setRecurring(v => !v)}
                className="w-full flex items-center justify-between gap-4 py-1"
              >
                <span className="text-sm text-gray-700">Needed every day</span>
                <span
                  className={`w-11 h-6 rounded-full p-0.5 flex shrink-0 transition-colors ${
                    recurring ? 'bg-emerald-700 justify-end' : 'bg-gray-300 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </span>
              </button>

              <label className="block">
                <span className="label">Notes (optional)</span>
                <textarea
                  className="m-input py-2.5"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Delivered before 7 PM, no onion or garlic."
                />
              </label>
            </div>

            <div className="m-actions">
              <button type="submit" className="m-btn-primary disabled:opacity-60" disabled={!valid || isBusy}>
                {editing ? 'Save changes' : 'Post requirement'}
              </button>
            </div>
          </form>
        </>
      )}
    </>
  );
}
