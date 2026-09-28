import { useEffect, useRef, useState, type CSSProperties } from 'react';

const COLORS = ['#F5A524', '#6D5EF6', '#2EC4B6', '#FF5D73', '#FFC857', '#5B8DEF'];

type ConfettiStyle = CSSProperties & { '--cx': string; '--cy': string; '--cr': string };

type Piece = {
  id: number;
  style: ConfettiStyle;
};

/** A ring of confetti that flies out from the middle when the popup opens. */
function makePieces(): Piece[] {
  return Array.from({ length: 20 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 20 + Math.random() * 0.4;
    const distance = 120 + Math.random() * 90;
    return {
      id: index,
      style: {
        background: COLORS[index % COLORS.length],
        animationDelay: `${(Math.random() * 0.18).toFixed(2)}s`,
        '--cx': `${Math.round(Math.cos(angle) * distance)}px`,
        '--cy': `${Math.round(Math.sin(angle) * distance - 24)}px`,
        '--cr': `${Math.round(Math.random() * 540 - 270)}deg`,
      },
    };
  });
}

/**
 * The celebration shown the moment a recipient is drawn. It is a blocking
 * dialog over the whole viewport, so the winner is impossible to miss, and it
 * carries a short confetti burst plus the name animation. Motion is decorative:
 * the name and the close button stay visible even when motion is reduced.
 */
export function WinnerDialog({
  name,
  kicker,
  amount,
  amountLabel,
  closeLabel,
  onClose,
}: {
  name: string;
  kicker: string;
  amount?: string;
  amountLabel?: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Kept in a ref so a re-render does not re-focus the button and steal focus.
  const close = useRef(onClose);
  close.current = onClose;
  const [pieces] = useState(makePieces);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="dialog-backdrop winner-backdrop" onClick={onClose}>
      <div
        className="dialog winner-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={`${kicker}: ${name}`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Decoration is clipped inside this layer, so the dialog itself never
            gets its own scroll box (an `overflow: hidden` dialog can be scrolled
            out of place when something inside it takes focus). */}
        <span className="winner-confetti" aria-hidden="true">
          <span className="winner-glow" />
          {pieces.map((piece) => (
            <i key={piece.id} style={piece.style} />
          ))}
        </span>

        <span className="winner-medal" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="46" height="46">
            <path
              d="M10 33 L7 15 L17 23 L24 11 L31 23 L41 15 L38 33 Z"
              fill="#F7B733"
              stroke="#B8801A"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <rect x="9.5" y="33" width="29" height="7" rx="3.5" fill="#F5A524" stroke="#B8801A" strokeWidth="1.6" />
            <circle cx="24" cy="8.5" r="2.6" fill="#FFF3D6" />
          </svg>
        </span>

        <span className="winner-kicker">{kicker}</span>
        <span className="winner-name">{name}</span>
        {amount && amountLabel ? <span className="winner-amount">{`${amountLabel}: ${amount}`}</span> : null}

        <button ref={closeRef} type="button" className="button winner-close" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
