import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Check, Loader, MapPin, Pencil, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAction, useMatchAnalysis } from '../lib/hooks';
import { DEFAULT_COORDS, requestCoords, type Coords } from '../lib/geo';
import { formatClock, toFutureIso } from '../lib/time';
import type { Donation } from '../types';
import { MSection, MDetail, MMeter } from './parts';

/** The collection deadline this flow assumes, matching the label it shows. */
const DEADLINE_TIME = '20:00';
const PICKUP_LOCATION = 'College Central Mess, Thapar University';

type Step = 'shoot' | 'read' | 'confirm' | 'done';

const READINGS = [
  'Dish class · Vegetarian, mixed thali',
  'Portion estimate · 48–52 meals',
  'Container · insulated trays, room temp',
];

export default function CreateDonationCamera() {
  const navigate = useNavigate();
  const { createDonation } = useApp();
  const { run, isBusy } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('shoot');
  const [photo, setPhoto] = useState<string | undefined>();
  const [qty, setQty] = useState(50);
  const [created, setCreated] = useState<Donation | null>(null);
  const [coords, setCoords] = useState<Coords>(DEFAULT_COORDS);
  const [gpsFixed, setGpsFixed] = useState(false);

  // Once published, show the reasoning the server actually used rather than
  // four decorative bars.
  const { analysis, recipientName: analysisRecipient } = useMatchAnalysis(created?.id ?? null);

  // The scripted "vision read". Swap this timer for the real endpoint later.
  // The pin, though, is fetched for real while it runs — by the time the
  // confirm step claims GPS, it either has one or says it is using the default.
  useEffect(() => {
    if (step !== 'read') return;
    let cancelled = false;

    void requestCoords().then(found => {
      if (cancelled || !found) return;
      setCoords(found);
      setGpsFixed(true);
    });

    const t = setTimeout(() => setStep('confirm'), 1800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [step]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
    setStep('read');
  };

  const publish = async () => {
    const deadline = toFutureIso(DEADLINE_TIME);
    if (!deadline) return;

    const donation = await run(
      'publish',
      () =>
        createDonation({
          foodName: 'Vegetarian Meals',
          category: 'Vegetarian',
          quantity: qty,
          unit: 'Meals',
          storageType: 'Room Temperature',
          description: 'Read from photo: dal makhani, paneer bhurji, rice. Insulated trays.',
          location: PICKUP_LOCATION,
          latitude: coords.latitude,
          longitude: coords.longitude,
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

  return (
    <>
      {step !== 'done' && (
        <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Step {step === 'shoot' ? 1 : step === 'read' ? 2 : 3} of 3
          </span>
          <div className="flex gap-1.5">
            {(['shoot', 'read', 'confirm'] as Step[]).map(s => (
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

      {step === 'shoot' && (
        <>
          <div className="mx-5 mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-100 h-64 flex flex-col items-center justify-center text-center px-6">
            <Camera size={28} className="text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">Point the camera at the tray</p>
          </div>
          <div className="p-5 space-y-2.5">
            <p className="text-sm text-gray-600 leading-relaxed">
              One photo is the whole form. The reader estimates the dish, the portion count and the
              storage type — you only correct what it gets wrong.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFile}
              className="hidden"
            />
            <button type="button" className="m-btn-primary" onClick={() => fileRef.current?.click()}>
              <Camera size={18} />
              Capture food
            </button>
            <button type="button" className="m-btn-secondary" onClick={() => navigate('/donor/create')}>
              <Pencil size={16} />
              Enter details by hand
            </button>
          </div>
        </>
      )}

      {step === 'read' && (
        <>
          {photo ? (
            <img src={photo} alt="" className="w-full h-56 object-cover" />
          ) : (
            <div className="w-full h-56 bg-gray-200" />
          )}
          <div className="p-5 space-y-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Reading photo
            </p>
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full w-8/12 rounded-full bg-emerald-600 transition-all duration-700" />
            </div>
            <div className="space-y-2.5 text-sm text-gray-700">
              {READINGS.map(r => (
                <p key={r} className="flex items-center gap-2">
                  <Check size={15} className="text-emerald-600 shrink-0" />
                  {r}
                </p>
              ))}
              <p className="flex items-center gap-2 text-gray-400">
                <Loader size={15} className="shrink-0 animate-spin" />
                Freshness window…
              </p>
            </div>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <div className="flex gap-4 p-5 bg-white border-b border-gray-200">
            {photo ? (
              <img src={photo} alt="" className="w-24 h-24 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-gray-200 shrink-0" />
            )}
            <div className="min-w-0">
              <span className="m-chip bg-emerald-50 text-emerald-700">
                <Sparkles size={11} />
                96% confident
              </span>
              <p className="mt-1.5 font-display font-semibold text-lg text-gray-900 leading-snug">
                {qty} Vegetarian Meals
              </p>
              <p className="text-xs text-gray-500">Dal makhani · paneer bhurji · rice</p>
            </div>
          </div>

          <MSection title="Correct anything" />

          <div className="flex items-center justify-between gap-4 px-5 py-3 bg-white border-b border-gray-100">
            <span className="text-sm text-gray-500">Quantity</span>
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setQty(q => Math.max(5, q - 5))}
                className="w-11 h-11 rounded-l-xl border border-gray-300 text-lg font-semibold text-gray-700 active:bg-gray-100"
                aria-label="Decrease quantity"
              >
                –
              </button>
              <span className="w-24 h-11 flex items-center justify-center border-y border-gray-300 text-sm font-semibold text-gray-900">
                {qty} meals
              </span>
              <button
                type="button"
                onClick={() => setQty(q => q + 5)}
                className="w-11 h-11 rounded-r-xl border border-gray-300 text-lg font-semibold text-gray-700 active:bg-gray-100"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          <MDetail label="Category" value="Vegetarian" />
          <MDetail label="Storage" value="Room temperature" />
          <MDetail
            label="Pickup before"
            value={
              <span className="text-clay-700 font-semibold">
                {formatClock(toFutureIso(DEADLINE_TIME) ?? '')}
              </span>
            }
          />

          <div className="m-5 rounded-2xl bg-gray-100 p-4 flex gap-3">
            <MapPin size={16} className="text-gray-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">{PICKUP_LOCATION}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {gpsFixed
                  ? `GPS fix · ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                  : `Saved default · ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`}
              </p>
            </div>
          </div>

          <div className="px-5 pb-6">
            <button
              type="button"
              className="m-btn-primary disabled:opacity-60"
              onClick={publish}
              disabled={isBusy}
            >
              {isBusy ? 'Publishing…' : 'Publish donation'}
              {!isBusy && <ArrowRight size={17} />}
            </button>
            <p className="mt-3 text-xs text-gray-500 leading-relaxed">
              Matching runs on publish: distance, capacity and intake reliability are scored against
              every kitchen within 8 km.
            </p>
          </div>
        </>
      )}

      {step === 'done' && (
        <>
          <section className="px-5 pt-6 pb-6 bg-emerald-700 text-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
              {created?.matchScore ? 'Top match' : 'Listed'}
            </p>
            <p className="mt-1.5 font-display font-semibold text-5xl leading-none">
              {created?.matchScore ? `${created.matchScore}%` : `${created?.quantity ?? qty}`}
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
            <button
              type="button"
              className="m-btn-secondary"
              onClick={() => {
                setStep('shoot');
                setPhoto(undefined);
                setCreated(null);
              }}
            >
              List another
            </button>
          </div>
        </>
      )}
    </>
  );
}
