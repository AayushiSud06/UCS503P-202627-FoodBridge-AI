import { useDonations } from '../context/AppContext';

const DONOR_ID = 'u-donor-1';
const BARS = [38, 52, 30, 74, 58, 100];
const MONTHS = ['MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG'];

export default function DonorImpact() {
  const mine = useDonations().filter(d => d.donorId === DONOR_ID);
  const meals = mine.reduce((s, d) => s + d.quantity, 0);

  const byKitchen = new Map<string, number>();
  mine.forEach(d => {
    if (!d.recipientName) return;
    byKitchen.set(d.recipientName, (byKitchen.get(d.recipientName) ?? 0) + d.quantity);
  });
  const kitchens = [...byKitchen.entries()].sort((a, b) => b[1] - a[1]);

  const km = mine.reduce((s, d) => s + (d.distanceKm ?? 0), 0);

  return (
    <>
      <section style={{ padding: 18, borderBottom: '2px solid var(--color-divider)' }}>
        <div className="m-kicker">Meals rescued</div>
        <div style={{ fontWeight: 800, fontSize: 64, lineHeight: 1, letterSpacing: '-0.03em', marginTop: 4 }}>
          {meals}
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: 14, height: 40, alignItems: 'flex-end' }}>
          {BARS.map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: `${h}%`,
                background: i === BARS.length - 1 ? 'var(--color-accent)' : 'var(--color-neutral-400)',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 10, color: 'rgba(32,30,29,.5)' }}>
          <span>{MONTHS[0]}</span>
          <span>{MONTHS[MONTHS.length - 1]}</span>
        </div>
      </section>

      {[
        ['CO₂ avoided', `${Math.round(meals * 0.86)} kg`],
        ['Food kept out of landfill', `${Math.round(meals * 0.45)} kg`],
        ['Volunteer kilometres', `${km.toFixed(1)} km`],
      ].map(([k, v]) => (
        <div key={k} style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13 }}>{k}</span>
          <span style={{ fontWeight: 800, fontSize: 13 }}>{v}</span>
        </div>
      ))}

      <div className="m-sec"><h6>Kitchens you supply</h6></div>
      {kitchens.map(([name, qty]) => (
        <div key={name} style={{ padding: '11px 18px', borderTop: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 13 }}>{name}</span>
          <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--color-accent-700)', flex: 'none' }}>{qty}</span>
        </div>
      ))}
      <div style={{ height: 18 }} />
    </>
  );
}
