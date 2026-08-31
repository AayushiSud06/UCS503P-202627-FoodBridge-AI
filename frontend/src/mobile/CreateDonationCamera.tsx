import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, Check, Loader, MapPin, Pencil } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Donation } from '../types';

type Step = 'shoot' | 'read' | 'confirm' | 'done';

const TITLES: Record<Step, string> = {
  shoot: 'Photograph the food',
  read: 'Reading the photo',
  confirm: 'Confirm what we read',
  done: 'Matched',
};

const READINGS = [
  'Dish class · Vegetarian, mixed thali',
  'Portion estimate · 48–52 meals',
  'Container · insulated trays, room temp',
];

export default function CreateDonationCamera() {
  const navigate = useNavigate();
  const { addDonation, showToast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('shoot');
  const [photo, setPhoto] = useState<string | undefined>();
  const [qty, setQty] = useState(50);
  const [created, setCreated] = useState<Donation | null>(null);

  // The scripted "vision read". Swap this timer for the real endpoint later.
  useEffect(() => {
    if (step !== 'read') return;
    const t = setTimeout(() => setStep('confirm'), 1800);
    return () => clearTimeout(t);
  }, [step]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
    setStep('read');
  };

  const publish = () => {
    const donation: Donation = {
      id: `don-${Date.now()}`,
      donorId: 'u-donor-1',
      donorName: 'Aayushi Sharma',
      donorOrganization: 'College Central Mess',
      foodName: 'Vegetarian Meals',
      category: 'Vegetarian',
      quantity: qty,
      unit: 'Meals',
      preparedAt: '12:30 PM',
      pickupDeadline: '8:00 PM',
      location: 'College Central Mess, Thapar University',
      description: 'Read from photo: dal makhani, paneer bhurji, rice. Insulated trays.',
      storageType: 'Room Temperature',
      imagePreview: photo,
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      matchScore: 94,
      distanceKm: 1.8,
    };
    addDonation(donation);
    setCreated(donation);
    showToast('success', 'Listed', `${qty} meals matched with Helping Hands Community Kitchen.`);
    setStep('done');
  };

  return (
    <>
      <header className="m-head" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/m/donor')}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <h4>{TITLES[step]}</h4>
        </div>
        <span className="m-label" style={{ flex: 'none' }}>
          {step === 'done' ? 'DONE' : `STEP ${step === 'shoot' ? 1 : step === 'read' ? 2 : 3}/3`}
        </span>
      </header>

      <div className="m-body">
        {step === 'shoot' && (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <div className="m-placeholder" style={{ flex: 1, minHeight: 380, position: 'relative' }}>
              <span>camera viewfinder — point at the tray</span>
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'rgba(32,30,29,.7)' }}>
                One photo is the whole form. Vision reads the dish, estimates portions and grades
                freshness; you only correct what it got wrong.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onFile}
                style={{ display: 'none' }}
              />
              <button type="button" className="m-btn m-btn-primary" onClick={() => fileRef.current?.click()}>
                <Camera size={18} />
                Capture food
              </button>
              <button type="button" className="m-btn m-btn-secondary" onClick={() => navigate('/donor/create')}>
                <Pencil size={16} />
                Enter details by hand
              </button>
            </div>
          </div>
        )}

        {step === 'read' && (
          <>
            {photo
              ? <img src={photo} alt="" style={{ width: '100%', height: 260, objectFit: 'cover', filter: 'grayscale(1) contrast(1.08)' }} />
              : <div className="m-placeholder" style={{ height: 260 }} />}
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="m-kicker">Reading photo</div>
              <div style={{ height: 4, background: 'var(--color-neutral-300)' }}>
                <div style={{ width: '72%', height: 4, background: 'var(--color-accent)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5 }}>
                {READINGS.map(r => (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Check size={14} style={{ color: 'var(--color-accent)', flex: 'none' }} />
                    {r}
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(32,30,29,.5)' }}>
                  <Loader size={14} style={{ flex: 'none' }} />
                  Freshness window…
                </div>
              </div>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div style={{ display: 'flex', borderBottom: '2px solid var(--color-divider)' }}>
              {photo
                ? <img src={photo} alt="" style={{ width: 110, height: 104, objectFit: 'cover', flex: 'none', filter: 'grayscale(1) contrast(1.08)', borderRight: '2px solid var(--color-divider)' }} />
                : <div className="m-placeholder" style={{ width: 110, height: 104, flex: 'none' }} />}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span className="m-tag m-tag-accent" style={{ alignSelf: 'flex-start' }}>Vision · 96% confident</span>
                <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>{qty} Vegetarian Meals</div>
                <div className="m-muted">Dal makhani · paneer bhurji · rice</div>
              </div>
            </div>

            <div className="m-sec"><h6>Correct anything</h6></div>

            <div style={{ padding: '10px 18px', borderTop: '1px solid var(--color-divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'rgba(32,30,29,.6)' }}>Quantity</span>
              <span style={{ display: 'flex', flex: 'none' }}>
                <button type="button" onClick={() => setQty(q => Math.max(5, q - 5))} style={{ width: 44, height: 44, border: '1px solid var(--color-divider)', background: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 800, fontSize: 16 }}>–</button>
                <span style={{ minWidth: 86, textAlign: 'center', lineHeight: '44px', fontWeight: 800, fontSize: 15, borderTop: '1px solid var(--color-divider)', borderBottom: '1px solid var(--color-divider)' }}>{qty} meals</span>
                <button type="button" onClick={() => setQty(q => q + 5)} style={{ width: 44, height: 44, border: '1px solid var(--color-divider)', background: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 800, fontSize: 16 }}>+</button>
              </span>
            </div>

            {[['Category', 'Vegetarian'], ['Storage', 'Room temperature']].map(([k, v]) => (
              <div key={k} style={{ padding: '12px 18px', borderTop: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'rgba(32,30,29,.6)' }}>{k}</span>
                <span style={{ fontWeight: 800, fontSize: 13 }}>{v}</span>
              </div>
            ))}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--color-divider)', borderBottom: '2px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'rgba(32,30,29,.6)' }}>Pickup before</span>
              <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--color-accent-700)' }}>8:00 PM</span>
            </div>

            <div style={{ padding: '12px 18px', display: 'flex', gap: 9, background: 'var(--color-surface)' }}>
              <MapPin size={15} style={{ marginTop: 2, flex: 'none' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 12.5 }}>College Central Mess, Thapar University</div>
                <div className="m-muted" style={{ marginTop: 2 }}>From your saved default · GPS confirmed</div>
              </div>
            </div>

            <div style={{ padding: '16px 18px 18px' }}>
              <button type="button" className="m-btn m-btn-primary" onClick={publish}>
                Publish donation
                <ArrowRight size={17} style={{ marginLeft: 'auto' }} />
              </button>
              <p className="m-muted" style={{ marginTop: 10 }}>
                Matching runs on publish: distance, capacity and intake reliability are scored
                against every kitchen within 8 km.
              </p>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <section className="m-poster">
              <div className="m-kicker" style={{ color: 'inherit', opacity: 0.85 }}>Matched in 4 seconds</div>
              <div className="m-poster-num" style={{ fontSize: 72, marginTop: 6 }}>
                {created?.matchScore ?? 94}%
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, marginTop: 8 }}>
                {created?.recipientName ?? 'Helping Hands Community Kitchen'}
              </div>
              <div style={{ fontSize: 12, marginTop: 3, opacity: 0.9 }}>
                Community kitchen · {created?.distanceKm ?? 1.8} km · 95% reliable
              </div>
            </section>

            <div className="m-sec"><h6>Why this kitchen</h6></div>
            {[['Distance', 98], ['Quantity fit', 92], ['Capacity', 88], ['Reliability', 95]].map(([label, v]) => (
              <div key={label as string} className="m-score">
                <span className="m-score-num">{v}%</span>
                <span className="m-score-track"><span className="m-score-fill" style={{ width: `${v}%`, display: 'block' }} /></span>
                <span className="m-score-label">{label}</span>
              </div>
            ))}

            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '2px solid var(--color-divider)' }}>
              {[['Kitchen notified · awaiting accept', true], ['Volunteer courier assigned', false], ['Picked up before 8:00 PM', false]].map(([label, done]) => (
                <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, flex: 'none', background: done ? 'var(--color-accent)' : 'var(--color-neutral-400)' }} />
                  <span style={{ fontSize: 12.5, fontWeight: done ? 800 : 400, color: done ? 'inherit' : 'rgba(32,30,29,.55)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ padding: '6px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" className="m-btn m-btn-primary" onClick={() => navigate('/m/donor')}>Back to home</button>
              <button type="button" className="m-btn m-btn-secondary" onClick={() => { setStep('shoot'); setPhoto(undefined); setCreated(null); }}>
                List another
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
