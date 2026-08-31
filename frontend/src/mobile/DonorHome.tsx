import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { useDonations } from '../context/AppContext';
import { STATUS_MOBILE, CLOSED } from './statusMeta';

const DONOR_ID = 'u-donor-1';

export default function DonorHome() {
  const navigate = useNavigate();
  const donations = useDonations();
  const mine = donations.filter(d => d.donorId === DONOR_ID);

  const totalMeals = mine.reduce((s, d) => s + d.quantity, 0);
  const active = mine.filter(d => !CLOSED.includes(d.status));
  const completed = mine.filter(d => d.status === 'COMPLETED');
  const redistributed = completed.reduce((s, d) => s + d.quantity, 0);
  const awaiting = mine.filter(d => d.status === 'AVAILABLE' || d.status === 'MATCHED');
  const scored = mine.filter(d => typeof d.matchScore === 'number');
  const avgMatch = scored.length
    ? Math.round(scored.reduce((s, d) => s + (d.matchScore ?? 0), 0) / scored.length)
    : 0;
  const kitchens = new Set(mine.map(d => d.recipientName).filter(Boolean)).size;

  return (
    <>
      <section className="m-poster">
        <div className="m-kicker" style={{ color: 'inherit', opacity: 0.85 }}>
          Meals donated · all time
        </div>
        <div className="m-poster-num" style={{ marginTop: 6 }}>{totalMeals}</div>
        <div style={{ fontSize: 12, marginTop: 8, opacity: 0.9 }}>
          {redistributed} already redistributed · {completed.length} pickups completed
        </div>
      </section>

      <div className="m-grid">
        <div className="m-cell"><div className="m-label">Active</div><div className="m-cell-num">{active.length}</div></div>
        <div className="m-cell"><div className="m-label">Awaiting pickup</div><div className="m-cell-num">{awaiting.length}</div></div>
        <div className="m-cell"><div className="m-label">Avg match</div><div className="m-cell-num">{avgMatch}%</div></div>
        <div className="m-cell"><div className="m-label">Kitchens served</div><div className="m-cell-num">{kitchens}</div></div>
      </div>

      <div className="m-sec" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h6>Active donations</h6>
        <button
          type="button"
          onClick={() => navigate('/m/donor/listings')}
          style={{ background: 'none', border: 0, font: 'inherit', fontSize: 11, color: 'var(--color-accent-700)', cursor: 'pointer' }}
        >
          View all
        </button>
      </div>

      {active.length === 0 ? (
        <p className="m-muted" style={{ padding: '6px 18px 18px' }}>
          Nothing live. List surplus food and it is matched in seconds.
        </p>
      ) : (
        active.map(d => {
          const meta = STATUS_MOBILE[d.status];
          return (
            <button key={d.id} type="button" className="m-row" onClick={() => navigate('/m/donor/listings')}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.09em', color: 'rgba(32,30,29,.5)' }}>
                    #{d.id}
                  </span>
                  <span className={`m-tag m-tag-${meta.tag}`}>{meta.label}</span>
                </span>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 15, lineHeight: 1.25, marginTop: 4 }}>
                  {d.quantity} {d.unit} · {d.foodName}
                </span>
                <span className="m-muted" style={{ display: 'block', marginTop: 3 }}>
                  Pickup by {d.pickupDeadline}
                  {d.distanceKm ? ` · ${d.distanceKm} km` : ''}
                  {d.volunteerName ? ` · ${d.volunteerName}` : d.recipientName ? ` · ${d.recipientName}` : ''}
                </span>
              </span>
              <ChevronRight size={16} style={{ marginTop: 14, color: 'rgba(32,30,29,.4)', flex: 'none' }} />
            </button>
          );
        })
      )}

      <div style={{ padding: '18px' }}>
        <button type="button" className="m-btn m-btn-primary" onClick={() => navigate('/m/donor/create')}>
          <Plus size={18} />
          List surplus food
        </button>
      </div>
    </>
  );
}
