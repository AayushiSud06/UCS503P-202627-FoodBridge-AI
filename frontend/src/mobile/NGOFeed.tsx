import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Clock, MapPin, Menu, Package, Plus } from 'lucide-react';
import { useDonations, useApp } from '../context/AppContext';
import { computeMockMatchScore, MOCK_RECIPIENTS } from '../data/mockData';
import type { Donation } from '../types';

const RECIPIENT = MOCK_RECIPIENTS[0];
const SORTS = ['BEST MATCH', 'NEAREST', 'CLOSING SOON'] as const;

export default function NGOFeed() {
  const navigate = useNavigate();
  const donations = useDonations();
  const { updateDonationStatus, showToast } = useApp();
  const [sort, setSort] = useState<(typeof SORTS)[number]>('BEST MATCH');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const available = donations
    .filter(d => d.status === 'AVAILABLE' || d.status === 'MATCHED')
    .sort((a, b) => {
      if (sort === 'NEAREST') return (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
      if (sort === 'CLOSING SOON') return a.pickupDeadline.localeCompare(b.pickupDeadline);
      return (b.matchScore ?? 0) - (a.matchScore ?? 0);
    });

  const selected = donations.find(d => d.id === openId) ?? null;
  const analysis = selected
    ? computeMockMatchScore(
        selected.quantity,
        RECIPIENT.capacity,
        selected.distanceKm ?? RECIPIENT.distanceKm,
        RECIPIENT.reliabilityScore
      )
    : null;

  const accept = (d: Donation) => {
    setBusy(true);
    updateDonationStatus(d.id, 'ACCEPTED', {
      recipientId: RECIPIENT.id,
      recipientName: RECIPIENT.name,
      matchScore: d.matchScore ?? 94,
      distanceKm: d.distanceKm ?? RECIPIENT.distanceKm,
    });
    showToast('success', 'Accepted', 'A volunteer courier will be assigned shortly.');
    setBusy(false);
    setOpenId(null);
  };

  return (
    <>
      <header className="m-head" style={{ alignItems: 'center' }}>
        <div>
          <div className="m-kicker">{RECIPIENT.name}</div>
          <h4 style={{ marginTop: 3 }}>Available now · {available.length}</h4>
        </div>
        <button
          type="button"
          onClick={() => navigate('/m')}
          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex', flex: 'none' }}
          aria-label="Switch role"
        >
          <Menu size={22} />
        </button>
      </header>

      <div style={{ display: 'flex', flex: 'none', borderBottom: '2px solid var(--color-divider)' }}>
        {SORTS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            style={{
              flex: 1, minHeight: 44, padding: '10px 0', cursor: 'pointer',
              font: 'inherit', fontWeight: 800, fontSize: 10.5, letterSpacing: '0.06em',
              border: 0, borderLeft: i === 0 ? 0 : '1px solid var(--color-divider)',
              background: sort === s ? 'var(--color-accent)' : 'transparent',
              color: sort === s ? 'var(--color-bg)' : 'rgba(32,30,29,.6)',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="m-body">
        {available.length === 0 && (
          <p className="m-muted" style={{ padding: 18 }}>
            No listings match your location right now. Check back soon.
          </p>
        )}

        {available.map(d => (
          <button key={d.id} type="button" className="m-row" onClick={() => setOpenId(d.id)} style={{ gap: 14 }}>
            <span style={{ flex: 'none' }}>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 30, lineHeight: 1, color: (d.matchScore ?? 0) >= 90 ? 'var(--color-accent)' : 'var(--color-text)' }}>
                {d.matchScore ?? '–'}
              </span>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 9, letterSpacing: '0.1em', color: 'rgba(32,30,29,.5)', marginTop: 3 }}>
                MATCH
              </span>
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{d.foodName}</span>
              <span className="m-muted" style={{ display: 'block', marginTop: 3 }}>
                {d.donorOrganization} · {d.donorName}
              </span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, fontSize: 11, color: 'rgba(32,30,29,.55)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Package size={11} />{d.quantity} {d.unit}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />{d.distanceKm ?? '–'} km</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />by {d.pickupDeadline}</span>
              </span>
            </span>
          </button>
        ))}

        <div className="m-sec"><h6>Standing requirement</h6></div>
        <div style={{ padding: '0 18px 20px' }}>
          <div style={{ padding: 13, background: 'var(--color-surface)' }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>120 hot meals daily · by 7:00 PM</div>
            <div className="m-muted" style={{ marginTop: 4 }}>
              Feeds 140 beneficiaries. High urgency, recurring. Listings matching this are pushed to you first.
            </div>
          </div>
        </div>
        <div style={{ height: 90 }} />
      </div>

      <button type="button" className="m-fab" onClick={() => navigate('/m')} aria-label="New requirement">
        <Plus size={26} />
      </button>

      {selected && analysis && (
        <>
          <button type="button" className="m-backdrop" onClick={() => setOpenId(null)} aria-label="Close" />
          <div className="m-sheet" role="dialog" aria-modal="true">
            <div className="m-grab"><div /></div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 18px 14px', borderBottom: '2px solid var(--color-divider)' }}>
              <div>
                <span className="m-tag m-tag-accent">AI match · rule-based (MAUT)</span>
                <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.2, marginTop: 7 }}>
                  {selected.quantity} {selected.unit} · {selected.foodName}
                </div>
                <div className="m-muted" style={{ marginTop: 2 }}>
                  {selected.donorOrganization} · {selected.distanceKm ?? '–'} km · pickup by {selected.pickupDeadline}
                </div>
              </div>
              <div style={{ flex: 'none' }}>
                <div style={{ fontWeight: 800, fontSize: 40, lineHeight: 1, color: 'var(--color-accent)' }}>
                  {analysis.overallScore}
                </div>
                <div style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.1em', color: 'rgba(32,30,29,.5)' }}>OVERALL</div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {[
                ['Distance & logistics', analysis.distanceScore],
                ['Quantity fit', analysis.quantityScore],
                ['Your capacity', analysis.capacityScore],
                ['Pickup window', analysis.pickupAvailabilityScore],
              ].map(([label, v]) => (
                <div key={label as string} className="m-score">
                  <span className="m-score-num">{v}%</span>
                  <span className="m-score-track"><span className="m-score-fill" style={{ width: `${v}%`, display: 'block' }} /></span>
                  <span className="m-score-label">{label}</span>
                </div>
              ))}

              <div className="m-sec"><h6>Why you were picked</h6></div>
              <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {analysis.reasons.map(r => (
                  <div key={r} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.5 }}>
                    <Check size={14} style={{ flex: 'none', marginTop: 3, color: 'var(--color-accent)' }} />
                    {r}
                  </div>
                ))}
              </div>
            </div>

            <div className="m-actions" style={{ flexDirection: 'row' }}>
              <button type="button" className="m-btn m-btn-secondary" style={{ width: 'auto', flex: 'none' }} onClick={() => setOpenId(null)}>
                Skip
              </button>
              <button type="button" className="m-btn m-btn-primary" disabled={busy} onClick={() => accept(selected)}>
                Accept {selected.quantity} {selected.unit.toLowerCase()}
                <ArrowRight size={17} style={{ marginLeft: 'auto' }} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
