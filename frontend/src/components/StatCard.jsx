const toneColor = {
  good: 'var(--sage-600)',
  warn: 'var(--brass-600)',
  bad: 'var(--rust-600)',
  info: 'var(--sky-600)',
};

export default function StatCard({ label, value, tone = 'info' }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 600, color: toneColor[tone], marginTop: 6 }}>
        {value}
      </div>
    </div>
  );
}
