import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Camera, ImagePlus, Loader, MapPin, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { errorMessage } from '../context/AuthContext';
import { useAction, useMatchAnalysis } from '../lib/hooks';
import { prepareDonationImage } from '../lib/image';
import { DEFAULT_COORDS, isValidCoords, requestCoords } from '../lib/geo';
import { formatClock, toFutureIso } from '../lib/time';
import { CATEGORIES, STORAGE_TYPES, UNITS } from '../pages/donor/CreateDonation';
import type { Donation, FoodCategory, FoodUnit, StorageType } from '../types';
import { MSection, MMeter } from './parts';

type Step = 'photo' | 'details' | 'done';

/**
 * What the donor fills in. Nothing here is read from the photo: FoodLink has no
 * image recognition, and the photo is only resized and attached (D-56). The
 * selects and the pin start where the desktop form's do; every text field, the
 * quantity and the deadline start empty.
 */
const EMPTY_FORM = {
  foodName: '',
  category: 'Vegetarian' as FoodCategory,
  quantity: '',
  unit: 'Meals' as FoodUnit,
  storageType: 'Room Temperature' as StorageType,
  pickupDeadline: '',
  location: '',
  description: '',
  latitude: String(DEFAULT_COORDS.latitude),
  longitude: String(DEFAULT_COORDS.longitude),
};

type Form = typeof EMPTY_FORM;
type Errors = Partial<Record<keyof Form | 'coords', string>>;

/** The desktop form's rules (`pages/donor/CreateDonation.tsx`), so both screens refuse the same drafts. */
function validate(form: Form): Errors {
  const errors: Errors = {};
  if (!form.foodName.trim()) errors.foodName = 'Food name is required';
  if (!form.quantity || Number(form.quantity) <= 0) errors.quantity = 'Enter a valid quantity';
  if (!form.pickupDeadline) errors.pickupDeadline = 'Pickup deadline is required';
  else if (!toFutureIso(form.pickupDeadline)) errors.pickupDeadline = 'Enter a valid pickup time';
  if (!form.location.trim()) errors.location = 'Location is required';
  if (!isValidCoords(Number(form.latitude), Number(form.longitude))) {
    errors.coords = 'Enter a valid latitude and longitude';
  }
  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
      <AlertCircle size={12} /> {message}
    </p>
  );
}

function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      <FieldError message={error} />
    </label>
  );
}

export default function CreateDonationCamera() {
  const navigate = useNavigate();
  const { createDonation, showToast } = useApp();
  const { run, isBusy } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('photo');
  const [photo, setPhoto] = useState<string | undefined>();
  const [isPreparing, setIsPreparing] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [isLocating, setIsLocating] = useState(false);
  const [created, setCreated] = useState<Donation | null>(null);

  // Once published, show the reasoning the server actually used rather than
  // four decorative bars.
  const { analysis, recipientName: analysisRecipient } = useMatchAnalysis(created?.id ?? null);

  const update = (field: keyof Form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    const key = field === 'latitude' || field === 'longitude' ? 'coords' : field;
    setErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearFileInput = () => {
    if (fileRef.current) fileRef.current.value = '';
  };

  // Resized and re-encoded before it is held, for the reason in `lib/image.ts`:
  // a camera capture is several times the size the donation row accepts (D-56).
  // That is all that happens to it — the details are the donor's to enter.
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPreparing(true);
    try {
      setPhoto(await prepareDonationImage(file));
      setStep('details');
    } catch (caught) {
      setPhoto(undefined);
      clearFileInput();
      showToast('error', 'Could not use that photo', errorMessage(caught));
    } finally {
      setIsPreparing(false);
    }
  };

  const removePhoto = () => {
    setPhoto(undefined);
    clearFileInput();
  };

  const useMyLocation = async () => {
    setIsLocating(true);
    const found = await requestCoords();
    setIsLocating(false);
    if (!found) {
      showToast('info', 'Location unavailable', 'Enter the pickup coordinates by hand instead.');
      return;
    }
    update('latitude', String(found.latitude));
    update('longitude', String(found.longitude));
  };

  const publish = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    const deadline = toFutureIso(form.pickupDeadline);
    if (Object.keys(found).length > 0 || !deadline) return;

    // The server owns everything not asked for here: who the donor is, the
    // match score, and the first entries in the status history.
    const donation = await run(
      'publish',
      () =>
        createDonation({
          foodName: form.foodName.trim(),
          category: form.category,
          quantity: Number(form.quantity),
          unit: form.unit,
          storageType: form.storageType,
          description: form.description.trim(),
          location: form.location.trim(),
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          preparedAt: null,
          pickupDeadline: deadline,
          imageUrl: photo ?? null,
        }),
      { errorTitle: 'Could not publish this donation' },
    );
    if (!donation) return;

    setCreated(donation);
    setStep('done');
  };

  const startOver = () => {
    setStep('photo');
    setPhoto(undefined);
    clearFileInput();
    setForm(EMPTY_FORM);
    setErrors({});
    setCreated(null);
  };

  return (
    <>
      {/* Mounted on every step, so a photo can be added from the details form too. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        className="hidden"
        id="m-food-image"
      />

      {step !== 'done' && (
        <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Step {step === 'photo' ? 1 : 2} of 2
          </span>
          <div className="flex gap-1.5">
            {(['photo', 'details'] as Step[]).map(s => (
              <span
                key={s}
                className={`w-6 h-1 rounded-full ${
                  s === step ? 'bg-emerald-700' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {step === 'photo' && (
        <>
          <div className="mx-5 mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-100 h-64 flex flex-col items-center justify-center text-center px-6">
            {isPreparing ? (
              <Loader size={28} className="text-gray-400 animate-spin" />
            ) : (
              <Camera size={28} className="text-gray-400" />
            )}
            <p className="mt-2 text-sm text-gray-500">
              {isPreparing ? 'Preparing photo…' : 'Photograph the food (optional)'}
            </p>
          </div>
          <div className="p-5 space-y-2.5">
            <p className="text-sm text-gray-600 leading-relaxed">
              A photo is shown to kitchens with your listing. FoodLink does not read or analyse it —
              you enter the food, quantity and pickup details yourself on the next step.
            </p>
            <button
              type="button"
              className="m-btn-primary"
              onClick={() => fileRef.current?.click()}
              disabled={isPreparing}
            >
              <Camera size={18} />
              Take a photo
            </button>
            <button
              type="button"
              className="m-btn-secondary"
              onClick={() => setStep('details')}
              disabled={isPreparing}
            >
              Continue without a photo
            </button>
          </div>
        </>
      )}

      {step === 'details' && (
        <form onSubmit={publish} noValidate>
          <div className="flex items-center gap-4 px-5 py-4 bg-white border-b border-gray-200">
            {photo ? (
              <img src={photo} alt="Attached food photo" className="w-16 h-16 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
                {isPreparing ? <Loader size={20} className="animate-spin" /> : <Camera size={20} />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">
                {photo ? 'Photo attached' : 'No photo attached'}
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {photo
                  ? 'Shown with the listing. The details below are what kitchens read.'
                  : 'Optional. Kitchens see the details below either way.'}
              </p>
            </div>
            {photo ? (
              <button type="button" className="m-btn-icon" onClick={removePhoto} aria-label="Remove photo">
                <X size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="m-btn-icon"
                onClick={() => fileRef.current?.click()}
                disabled={isPreparing}
                aria-label="Add a photo"
              >
                <ImagePlus size={16} />
              </button>
            )}
          </div>

          <MSection title="Food" />
          <div className="px-5 space-y-4">
            <Field label="Food name" error={errors.foodName}>
              <input
                id="m-food-name"
                className="m-input"
                value={form.foodName}
                onChange={e => update('foodName', e.target.value)}
                placeholder="e.g. Vegetable biryani"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select
                  id="m-category"
                  className="m-input"
                  value={form.category}
                  onChange={e => update('category', e.target.value)}
                >
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Storage">
                <select
                  id="m-storage-type"
                  className="m-input"
                  value={form.storageType}
                  onChange={e => update('storageType', e.target.value)}
                >
                  {STORAGE_TYPES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity" error={errors.quantity}>
                <input
                  id="m-quantity"
                  className="m-input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.quantity}
                  onChange={e => update('quantity', e.target.value)}
                  placeholder="40"
                />
              </Field>
              <Field label="Unit">
                <select
                  id="m-unit"
                  className="m-input"
                  value={form.unit}
                  onChange={e => update('unit', e.target.value)}
                >
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </Field>
            </div>

            <Field
              label="Pickup before"
              error={errors.pickupDeadline}
              hint="A time already past today means tomorrow."
            >
              <input
                id="m-pickup-deadline"
                className="m-input"
                type="time"
                value={form.pickupDeadline}
                onChange={e => update('pickupDeadline', e.target.value)}
              />
            </Field>

            <Field label="Description (optional)">
              <textarea
                id="m-description"
                className="m-input py-2.5"
                rows={3}
                value={form.description}
                onChange={e => update('description', e.target.value)}
                placeholder="Dishes, allergens, gate instructions for the courier."
              />
            </Field>
          </div>

          <MSection title="Pickup" />
          <div className="px-5 space-y-4">
            <Field label="Pickup address" error={errors.location}>
              <input
                id="m-location"
                className="m-input"
                value={form.location}
                onChange={e => update('location', e.target.value)}
                placeholder="Building, street and area"
              />
            </Field>

            <div>
              <span className="label">Pickup pin</span>
              <div className="grid grid-cols-2 gap-3">
                <input
                  id="m-latitude"
                  className="m-input"
                  type="number"
                  inputMode="decimal"
                  step="0.000001"
                  value={form.latitude}
                  onChange={e => update('latitude', e.target.value)}
                  aria-label="Latitude"
                  placeholder="Latitude"
                />
                <input
                  id="m-longitude"
                  className="m-input"
                  type="number"
                  inputMode="decimal"
                  step="0.000001"
                  value={form.longitude}
                  onChange={e => update('longitude', e.target.value)}
                  aria-label="Longitude"
                  placeholder="Longitude"
                />
              </div>
              {errors.coords ? (
                <FieldError message={errors.coords} />
              ) : (
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                  Kitchens are ranked by straight-line distance from this pin, so it has to be right.
                </p>
              )}
              <button
                type="button"
                className="m-btn-secondary mt-2.5"
                onClick={useMyLocation}
                disabled={isLocating}
              >
                {isLocating ? <Loader size={16} className="animate-spin" /> : <MapPin size={16} />}
                {isLocating ? 'Locating…' : 'Use my location'}
              </button>
            </div>
          </div>

          <div className="p-5 pb-6">
            <button
              type="submit"
              className="m-btn-primary disabled:opacity-60"
              disabled={isBusy || isPreparing}
            >
              {isBusy ? 'Publishing…' : 'Publish donation'}
              {!isBusy && <ArrowRight size={17} />}
            </button>
            <p className="mt-3 text-xs text-gray-500 leading-relaxed">
              Matching runs on publish: distance, capacity and intake reliability are scored against
              every kitchen within 8 km.
            </p>
          </div>
        </form>
      )}

      {step === 'done' && (
        <>
          <section className="px-5 pt-6 pb-6 bg-emerald-700 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
              {created?.matchScore ? 'Top match' : 'Listed'}
            </p>
            <p className="mt-1.5 font-display font-semibold text-5xl leading-none">
              {created?.matchScore ? `${created.matchScore}%` : `${created?.quantity ?? ''}`}
            </p>
            <p className="mt-3 font-medium">
              {analysis ? analysisRecipient : 'Open to every kitchen in range'}
            </p>
            <p className="text-sm text-emerald-100 mt-0.5">
              {analysis
                ? `${analysis.distanceKm} km in a straight line · ${analysis.reliabilityScore}% reliable`
                : 'No kitchen has accepted it yet.'}
            </p>
          </section>

          <MSection title={analysis ? 'Why this kitchen' : 'Scoring'} />
          <div className="bg-white border-y border-gray-100 py-1.5">
            {analysis ? (
              <>
                <MMeter label="Distance" score={analysis.distanceScore} />
                <MMeter label="Quantity fit" score={analysis.quantityScore} />
                <MMeter label="Capacity" score={analysis.capacityScore} />
                <MMeter label="Reliability" score={analysis.reliabilityScore} />
              </>
            ) : (
              <p className="px-5 py-4 text-sm text-gray-500 leading-relaxed">
                No verified kitchen within range scored this donation yet.
              </p>
            )}
          </div>

          <MSection title="What happens next" />
          <div className="px-5 pb-2 space-y-3">
            {([
              ['Listed for kitchens · awaiting accept', true],
              ['Volunteer courier assigned', false],
              [`Picked up before ${formatClock(created?.pickupDeadline)}`, false],
            ] as [string, boolean][]).map(([label, done]) => (
              <div key={label} className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${done ? 'bg-emerald-600' : 'bg-gray-300'}`}
                />
                <span className={`text-sm ${done ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div className="p-5 space-y-2.5">
            <button type="button" className="m-btn-primary" onClick={() => navigate('/m/donor')}>
              Back to home
            </button>
            <button type="button" className="m-btn-secondary" onClick={startOver}>
              List another
            </button>
          </div>
        </>
      )}
    </>
  );
}
