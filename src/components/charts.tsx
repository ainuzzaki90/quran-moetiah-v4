'use client';

// Grafik ringan tanpa library (SVG/HTML), ikut tema terang/gelap lewat CSS variable.

export function LineChart({ data, height = 170 }: { data: { label: string; value: number }[]; height?: number }) {
  const W = 620, padL = 30, padR = 12, padT = 18, padB = 26;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const x = (i: number) => padL + (data.length <= 1 ? 0 : (i * (W - padL - padR)) / (data.length - 1));
  const y = (v: number) => padT + (1 - v / top) * (height - padT - padB);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Grafik tren setoran per minggu">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(top * t)} y2={y(top * t)} stroke="var(--border)" strokeWidth="1" />
          <text x={padL - 5} y={y(top * t) + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{Math.round(top * t)}</text>
        </g>
      ))}
      <polyline points={pts} fill="none" stroke="var(--navy-light)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.value)} r="3.5" fill="var(--navy-light)"><title>{`Minggu ${d.label}: ${d.value} setoran`}</title></circle>
          <text x={x(i)} y={y(d.value) - 8} textAnchor="middle" fontSize="10" fill="var(--ink)">{d.value}</text>
          <text x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function BarRows({ rows, max, unit = '', color = 'var(--navy-light)' }: {
  rows: { label: string; value: number | null; note?: string; color?: string }[]; max?: number; unit?: string; color?: string;
}) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value || 0));
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 32%) 1fr auto', alignItems: 'center', gap: 8, margin: '7px 0' }}>
          <span style={{ fontSize: 13 }}>{r.label}</span>
          <div style={{ background: 'var(--surface-alt)', borderRadius: 6, height: 14, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(0, Math.min(100, ((r.value || 0) / m) * 100))}%`, height: '100%', background: r.color || color, borderRadius: 6, transition: 'width .3s' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 46, textAlign: 'right' }}>{r.value === null ? '-' : r.value}{r.value === null ? '' : unit}{r.note ? <span className="tf-empty" style={{ fontWeight: 400 }}> {r.note}</span> : null}</span>
        </div>
      ))}
    </div>
  );
}
