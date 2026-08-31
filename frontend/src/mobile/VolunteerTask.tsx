import { useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, Navigation, Phone } from 'lucide-react';
import { useDonations, useApp } from '../context/AppContext';
import type { Donation, DonationStatus } from '../types';
import { STATUS_MOBILE } from './statusMeta';

const VOLUNTEER_ID = 'v-1';
const VOLUNTEER_NAME = 'Aarav Sharma';

const NEXT: Partial<Record<DonationStatus, { status: DonationStatus; cta: string; hint: string }>> = {
  ACCEPTED: { status: 'VOLUNTEER_ASSIGNED', cta: 'Accept pickup', hint: 'Accept within 10 minutes or the task returns to the pool.' },
  VOLUNTEER_ASSIGNED: { status: 'PICKED_UP', cta: 'Mark picked up', hint: 'Collect from the pickup point and confirm the load.' },
  PICKED_UP: { status: 'DELIVERED', cta: 'Mark delivered', hint: 'On the way to the recipient.' },
};

export default function VolunteerTask() {
  const navigate = useNavigate();
  const donations = useDonations();
  const { updateDonationStatus, showToast } = useApp();

  const task: Donation | undefined =
    donations.find(d => d.volunteerId === VOLUNTEER_ID && !['COMPLETED', 'CANCELLED'].includes(d.status)) ??
    donations.find(d => d.status === 'ACCEPTED');

  if (!task) {
    return (
      <>
        <header className="m-head"><div><div className="m-kicker">Courier</div><h4 style={{ marginTop: 3 }}>All caught up</h4></div></header>
        <div className="m-body"><p className="m-muted" style={{ padding: 18 }}>No active pickup. New tasks appear here the moment a kitchen accepts a donation.</p></div>
      </>
    );
  }

  const meta = STATUS_MOBILE[task.status];
  const next = NEXT[task.status];
  const done = !next;

  const advance = () => {
    if (!next) return;
    const extra = next.status === 'VOLUNTEER_ASSIGNED'
      ? { volunteerId: VOLUNTEER_ID, volunteerName: VOLUNTEER_NAME }
      : undefined;
    updateDonationStatus(task.id, next.status, extra);
    showToast('success', next.cta, `#${task.id} → ${next.status.replace('_', ' ').toLowerCase()}`);
  };

  const steps: [string, string | undefined][] = [
    ['Listed by donor', task.createdAt],
    ['Matched', task.matchedAt],
    ['Accepted by kitchen', task.acceptedAt],
    ['Courier assigned', task.volunteerAssignedAt],
    ['Picked up', task.pickedUpAt],
    ['Delivered', task.deliveredAt],
  ];

  const time = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';

  return (
    <>
      <header className="m-head" style={{ alignItems: 'center' }}>
        <div>
          <div className="m-kicker">Pickup #{task.id}</div>
          <h4 style={{ marginTop: 3 }}>{task.quantity} {task.unit} · {task.foodName}</h4>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
          <span className={`m-tag m-tag-${meta.tag}`}>{meta.label}</span>
          <button type="button" onClick={() => navigate('/m')} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }} aria-label="Switch role">
            <Menu size={20} />
          </button>
        </span>
      </header>

      <div className="m-body">
        <div className="m-placeholder" style={{ height: 220, borderBottom: '2px solid var(--color-divider)' }}>
          <span>route map — {task.distanceKm ?? '~2'} km</span>
        </div>

        <div style={{ padding: '14px 18px', borderBottom: '2px solid var(--color-divider)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {([['A', 'COLLECT', task.location, task.donorOrganization], ['B', 'DELIVER', task.recipientName ?? 'To be assigned', 'Recipient kitchen']] as const).map(([pin, label, line1, line2], i) => (
            <div key={pin} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 26, height: 26, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 11,
                background: i === 0 ? 'var(--color-text)' : 'transparent',
                color: i === 0 ? 'var(--color-bg)' : 'inherit',
                border: i === 0 ? 0 : '2px solid var(--color-text)',
              }}>{pin}</div>
              <div>
                <div className="m-label">{label}</div>
                <div style={{ fontWeight: 800, fontSize: 14, marginTop: 2 }}>{line1}</div>
                <div className="m-muted">{line2}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '2px solid var(--color-divider)' }}>
          {([['LOAD', `${task.quantity} ${task.unit}`, false], ['DEADLINE', task.pickupDeadline, true], ['STORAGE', task.storageType.split(' ')[0], false]] as const).map(([k, v, hot], i) => (
            <div key={k} style={{ padding: '12px 14px', borderRight: i < 2 ? '1px solid var(--color-divider)' : 0 }}>
              <div className="m-label" style={{ fontSize: 9 }}>{k}</div>
              <div style={{ fontWeight: 800, fontSize: 17, marginTop: 2, color: hot ? 'var(--color-accent)' : 'inherit' }}>{v}</div>
            </div>
          ))}
        </div>

        <div className="m-sec"><h6>Chain of custody</h6></div>
        {steps.map(([label, iso]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderTop: '1px solid var(--color-divider)' }}>
            <span style={{ width: 9, height: 9, flex: 'none', background: iso ? 'var(--color-text)' : 'var(--color-neutral-400)' }} />
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: iso ? 800 : 400, color: iso ? 'inherit' : 'rgba(32,30,29,.5)' }}>{label}</span>
            <span style={{ fontSize: 11, color: 'rgba(32,30,29,.5)' }}>{time(iso)}</span>
          </div>
        ))}

        {task.description && (
          <div style={{ padding: '16px 18px 20px' }}>
            <div style={{ padding: 12, background: 'var(--color-surface)', fontSize: 11.5, lineHeight: 1.55, color: 'rgba(32,30,29,.75)' }}>
              <strong style={{ fontWeight: 800 }}>Handling note. </strong>{task.description}
            </div>
          </div>
        )}
      </div>

      <div className="m-actions">
        <div style={{ fontSize: 11, color: 'rgba(32,30,29,.55)' }}>
          {next ? next.hint : `Delivered. ${task.quantity} ${task.unit} logged against your record.`}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="m-btn m-btn-secondary m-btn-icon" aria-label="Call"><Phone size={17} /></button>
          <button type="button" className="m-btn m-btn-secondary m-btn-icon" aria-label="Navigate"><Navigation size={17} /></button>
          <button type="button" className="m-btn m-btn-primary" disabled={done} onClick={advance}>
            {next ? next.cta : 'Task complete'}
            {next && <ArrowRight size={17} style={{ marginLeft: 'auto' }} />}
          </button>
        </div>
      </div>
    </>
  );
}
