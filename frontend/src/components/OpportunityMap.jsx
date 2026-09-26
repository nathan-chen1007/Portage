import { useState } from "react";
import { ease, flag } from "../lib/format.js";

const W = 560;
const H = 300;
const PAD = { l: 44, r: 16, t: 16, b: 36 };
const x = (easeScore) => PAD.l + (easeScore / 100) * (W - PAD.l - PAD.r);
const y = (opp) => H - PAD.b - (opp / 100) * (H - PAD.t - PAD.b);

/** 2×2: ease across (easier on the right), prize up. Top-right = go first. */
export function OpportunityMap({ markets, selected, onSelect }) {
  const [hover, setHover] = useState(null);
  const pts = markets.filter((m) => m.status !== "blocked" && m.opportunity != null && m.score != null);
  if (pts.length === 0) return null;
  const h = pts.find((m) => m.country_code === hover);

  // Direct labels sit beside each dot (left of it near the right edge); nudge up or down when one would collide.
  const labels = {};
  const placed = [];
  for (const m of [...pts].sort((a, b) => ease(b) - ease(a))) {
    const right = x(ease(m)) > W - PAD.r - 30;
    const lx = right ? x(ease(m)) - 10 : x(ease(m)) + 10;
    let ly = y(m.opportunity) + 4;
    for (let tries = 0; tries < 6; tries++) {
      const hit = placed.find((p) => Math.abs(p.x - lx) < 26 && Math.abs(p.y - ly) < 12);
      if (!hit) break;
      ly = hit.y + (ly <= hit.y ? -12 : 12);
    }
    placed.push({ x: lx, y: ly });
    labels[m.country_code] = { x: lx, y: ly, anchor: right ? "end" : "start" };
  }

  return (
    <figure className="rounded-xl border border-neutral-200 p-4">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Opportunity map</span>
        <span className="text-xs text-neutral-500">Top-right: worth it and easy to enter</span>
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Markets by ease and opportunity">
          {/* quadrant backdrop and labels */}
          <rect x={x(50)} y={y(100)} width={x(100) - x(50)} height={y(50) - y(100)} fill="#10b981" opacity="0.06" />
          <line x1={x(50)} x2={x(50)} y1={y(0)} y2={y(100)} stroke="#e5e5e5" />
          <line x1={x(0)} x2={x(100)} y1={y(50)} y2={y(50)} stroke="#e5e5e5" />
          {[
            ["Big but hard", x(2), y(96), "start"],
            ["Go first", x(98), y(96), "end"],
            ["Avoid", x(2), y(4), "start"],
            ["Easy but small", x(98), y(4), "end"],
          ].map(([t, tx, ty, anchor]) => (
            <text key={t} x={tx} y={ty} textAnchor={anchor} className="fill-neutral-400" fontSize="11">
              {t}
            </text>
          ))}
          {/* axes */}
          <line x1={x(0)} x2={x(100)} y1={y(0)} y2={y(0)} stroke="#d4d4d4" />
          <line x1={x(0)} x2={x(0)} y1={y(0)} y2={y(100)} stroke="#d4d4d4" />
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <text x={x(v)} y={y(0) + 14} textAnchor="middle" fontSize="10" className="fill-neutral-400">{v}</text>
              <text x={x(0) - 6} y={y(v) + 3} textAnchor="end" fontSize="10" className="fill-neutral-400">{v}</text>
            </g>
          ))}
          <text x={(x(0) + x(100)) / 2} y={H - 4} textAnchor="middle" fontSize="11" className="fill-neutral-500">
            Ease (higher is easier) →
          </text>
          <text x={12} y={(y(0) + y(100)) / 2} textAnchor="middle" fontSize="11" className="fill-neutral-500"
            transform={`rotate(-90 12 ${(y(0) + y(100)) / 2})`}>
            Opportunity →
          </text>
          {/* points */}
          {pts.map((m) => {
            const sel = m.country_code === selected;
            return (
              <g key={m.country_code} onMouseEnter={() => setHover(m.country_code)} onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(m.country_code)} style={{ cursor: "pointer" }} data-testid={`pt-${m.country_code}`}>
                <circle cx={x(ease(m))} cy={y(m.opportunity)} r="14" fill="transparent" />
                <circle cx={x(ease(m))} cy={y(m.opportunity)} r={sel ? 7 : 5.5} fill={sel ? "#171717" : "#525252"}
                  stroke="#fff" strokeWidth="2" />
                <text x={labels[m.country_code].x} y={labels[m.country_code].y} textAnchor={labels[m.country_code].anchor} fontSize="11"
                  className={sel ? "fill-neutral-900 font-semibold" : "fill-neutral-600"}>
                  {m.country_code}
                </text>
              </g>
            );
          })}
        </svg>
        {h && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 shadow-sm">
            {flag(h.country_code)} {h.country} · prize {h.opportunity.toFixed(0)} · ease {ease(h).toFixed(0)} · score{" "}
            {h.overall?.toFixed(0)}
          </div>
        )}
      </div>
    </figure>
  );
}
