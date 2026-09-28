import { useEffect, useRef, useState, type CSSProperties, type TransitionEvent } from 'react';

/* Alternating hues, chosen so no two neighbours match and white labels stay
 * readable — the wheel has to look like a wheel even with only two names. */
const COLORS = ['#6D5EF6', '#E08B1E', '#12A594', '#E14D67', '#4078D6', '#EFC13C'];

const SIZE = 256;
const RADIUS = 96;
const RIM = RADIUS + 16;
const BULBS = 12;

/** Must match the transition on .wheel-disc in styles.css. */
const SPIN_MS = 4200;
const REDUCED_MS = 300;

/**
 * The wheel must always resolve, so the spin is finished by a timer. A
 * `transitionend` can finish it sooner, but it never fires when animations are
 * skipped (e.g. prefers-reduced-motion, or a background tab), which used to
 * leave the wheel spinning forever.
 */
function spinDuration(): number {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? REDUCED_MS : SPIN_MS;
}

function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}

function point(cx: number, cy: number, radius: number, deg: number): [number, number] {
  const rad = (Math.PI / 180) * deg;
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
}

function wedge(cx: number, cy: number, radius: number, start: number, end: number): string {
  const [x1, y1] = point(cx, cy, radius, start);
  const [x2, y2] = point(cx, cy, radius, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

/** A five-point star centred on the origin, used as the hub mark. */
const STAR = '0,-9 2.47,-3.4 8.56,-2.78 4,1.3 5.29,7.28 0,4.2 -5.29,7.28 -4,1.3 -8.56,-2.78 -2.47,-3.4';

export function PrizeWheel({
  names,
  disabled,
  label,
  busyLabel,
  onResult,
}: {
  names: string[];
  disabled?: boolean;
  label: string;
  /** Shown on the button while the wheel is in motion. */
  busyLabel?: string;
  onResult: (index: number) => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const angle = useRef(0);
  /** Winner waiting to be reported, or null when nothing is in flight. */
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const slice = 360 / Math.max(names.length, 1);

  useEffect(
    () => () => {
      if (timer.current !== null) globalThis.clearTimeout(timer.current);
    },
    [],
  );

  /** Reports the pending winner exactly once. */
  function settle(): void {
    if (timer.current !== null) {
      globalThis.clearTimeout(timer.current);
      timer.current = null;
    }
    const index = pending.current;
    if (index === null) return;
    pending.current = null;
    setBusy(false);
    onResult(index);
  }

  function spin(): void {
    if (disabled || busy || names.length === 0) return;
    const winnerIndex = Math.floor(Math.random() * names.length);
    const desired = mod(-(winnerIndex + 0.5) * slice, 360);
    const from = mod(angle.current, 360);
    let delta = desired - from;
    if (delta < 0) delta += 360;
    const next = angle.current + 360 * 5 + delta;
    pending.current = winnerIndex;
    angle.current = next;
    setBusy(true);
    setRotation(next);
    timer.current = globalThis.setTimeout(settle, spinDuration());
  }

  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>): void {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    settle();
  }

  return (
    <div className="wheel-wrap">
      <div className={`wheel-stage${busy ? ' busy' : ''}`}>
        <span className="wheel-halo" aria-hidden="true" />
        <div className="wheel-disc-wrap">
          <span className="wheel-pointer" aria-hidden="true">
            <svg viewBox="0 0 24 26">
              <path
                d="M12 1a8 8 0 0 0-8 8c0 5.2 8 16 8 16s8-10.8 8-16a8 8 0 0 0-8-8z"
                fill="#FFC857"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="9" r="3.1" fill="#FFFFFF" />
            </svg>
          </span>
          <div
            className="wheel-disc"
            style={{ transform: `rotate(${rotation}deg)` }}
            onTransitionEnd={handleTransitionEnd}
          >
            <svg width={SIZE} height={SIZE} role="img" aria-label={label}>
              <defs>
                <linearGradient id="wheel-rim" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#8B7DFF" />
                  <stop offset="1" stopColor="#5A4BD6" />
                </linearGradient>
                <radialGradient id="wheel-gloss" cx="0.34" cy="0.26" r="0.8">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="0.36" />
                  <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.06" />
                  <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Outer rim with lights. */}
              <circle cx={cx} cy={cy} r={RIM + 8} fill="url(#wheel-rim)" />
              <circle cx={cx} cy={cy} r={RIM + 8} fill="none" stroke="#3F32A8" strokeWidth="2" />
              {Array.from({ length: BULBS }, (_, index) => {
                const deg = -90 + (360 / BULBS) * index;
                const [bx, by] = point(cx, cy, RIM + 3, deg);
                const style: CSSProperties = { animationDelay: `${(index / BULBS) * 1.4}s` };
                return <circle key={index} className="wheel-bulb" cx={bx} cy={by} r={3.1} style={style} />;
              })}
              <circle cx={cx} cy={cy} r={RADIUS + 4} fill="#FFFFFF" />

              {/* Wedges. */}
              {names.map((name, index) => {
                const start = -90 + index * slice;
                const end = start + slice;
                const mid = start + slice / 2;
                const [tx, ty] = point(cx, cy, RADIUS * 0.6, mid);
                const label2 = name.length > 9 ? `${name.slice(0, 8)}…` : name;
                const fontSize = names.length > 9 ? 10 : names.length > 6 ? 11.5 : 13;
                return (
                  <g key={`${name}-${index}`}>
                    {names.length === 1 ? (
                      <circle cx={cx} cy={cy} r={RADIUS} fill={COLORS[0]} />
                    ) : (
                      <path
                        d={wedge(cx, cy, RADIUS, start, end - 0.7)}
                        fill={COLORS[index % COLORS.length]}
                        stroke="#FFFFFF"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    )}
                    <text
                      x={tx}
                      y={ty}
                      fill="#FFFFFF"
                      fontSize={fontSize}
                      fontWeight="800"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ paintOrder: 'stroke', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.35))' }}
                    >
                      {label2}
                    </text>
                  </g>
                );
              })}

              {/* Glass highlight and hub. */}
              <circle cx={cx} cy={cy} r={RADIUS} fill="url(#wheel-gloss)" pointerEvents="none" />
              <circle cx={cx} cy={cy} r={24} fill="#1F1B3A" />
              <circle cx={cx} cy={cy} r={24} fill="none" stroke="#FFFFFF" strokeWidth="3" opacity="0.9" />
              <g transform={`translate(${cx} ${cy})`}>
                <polygon points={STAR} fill="#FFC857" />
              </g>
            </svg>
          </div>
        </div>
      </div>

      <button type="button" className="spin-button" disabled={disabled || busy} onClick={spin}>
        {busy ? busyLabel ?? label : label}
      </button>
    </div>
  );
}
