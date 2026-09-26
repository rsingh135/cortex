"use client";
/** Inline SVG sparkline for 0..1 values; `markers` are indices to dot (recall days). */

export interface SparklineProps {
  values: readonly number[];
  markers?: readonly number[];
  width?: number;
  height?: number;
  label: string;
}

export function Sparkline({ values, markers = [], width = 160, height = 36, label }: SparklineProps) {
  const pad = 3;
  const n = values.length;
  const x = (i: number) => (n > 1 ? pad + (i / (n - 1)) * (width - 2 * pad) : width / 2);
  const y = (v: number) => pad + (1 - Math.min(1, Math.max(0, v))) * (height - 2 * pad);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = n > 0 ? values[n - 1] : 0;
  const area = n > 1 ? `${path} L${x(n - 1).toFixed(1)} ${(height - pad).toFixed(1)} L${x(0).toFixed(1)} ${(height - pad).toFixed(1)} Z` : "";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="block overflow-visible">
      <line x1={pad} x2={width - pad} y1={y(0.5)} y2={y(0.5)} className="stroke-zinc-200" strokeDasharray="2 3" strokeWidth={1} />
      {area && <path d={area} className="fill-sky-100/70" />}
      {n > 0 && <path d={path} className="stroke-sky-600" strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
      {markers
        .filter((i) => i >= 0 && i < n)
        .map((i) => <circle key={i} cx={x(i)} cy={y(values[i])} r={2.5} className="fill-amber-500 stroke-white" strokeWidth={1.5} />)}
      {n > 0 && <circle cx={x(n - 1)} cy={y(last)} r={3.5} className="fill-sky-600 stroke-white" strokeWidth={2} />}
    </svg>
  );
}
