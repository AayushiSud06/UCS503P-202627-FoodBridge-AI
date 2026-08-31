import { useState } from 'react';
import { Package, Clock, MapPin } from 'lucide-react';
import { useDonations } from '../context/AppContext';
import { STATUS_MOBILE, CLOSED } from './statusMeta';

const DONOR_ID = 'u-donor-1';
const FILTERS = ['ALL', 'LIVE', 'CLOSED'] as const;

export default function DonorListings() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const mine = useDonations().filter(d => d.donorId === DONOR_ID);

  const rows = mine.filter(d => {
    if (filter === 'LIVE') return !CLOSED.includes(d.status);
    if (filter === 'CLOSED') return CLOSED.includes(d.status);
    return true;
  });

  return (
    <>
      <div style={{ display: 'flex', borderBottom: '2px solid var(--color-divider)' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1, minHeight: 44, padding: '11px 0', cursor: 'pointer',
              font: 'inherit', fontWeight: 800, fontSize: 11, letterSpacing: '0.06em',
              border: 0, borderLeft: f === 'ALL' ? 0 : '1px solid var(--color-divider)',
              background: filter === f ? 'var(--color-accent)' : 'transparent',
              color: filter === f ? 'var(--color-bg)' : 'rgba(32,30,29,.6)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="m-muted" style={{ padding: 18 }}>Nothing here yet.</p>
      )}

      {rows.map(d => {
        const meta = STATUS_MOBILE[d.status];
        return (
          <article key={d.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-divider)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.09em', color: 'rgba(32,30,29,.5)' }}>
                #{d.id} · {d.category}
              </span>
              <span className={`m-tag m-tag-${meta.tag}`}>{meta.label}</span>
            </div>
            <h4 style={{ fontSize: 16, lineHeight: 1.25, marginTop: 5 }}>{d.foodName}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8 }} className="m-muted">
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Package size={12} />{d.quantity} {d.unit}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} />{d.pickupDeadline}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={12} />{d.distanceKm ? `${d.distanceKm} km` : d.location.split(',')[0]}
              </span>
            </div>
          </article>
        );
      })}
    </>
  );
}
