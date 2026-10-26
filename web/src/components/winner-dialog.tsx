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
 * Celebration when a recipient is drawn. Pay closes the month for this winner,
 * Respin clears the pick so the wheel can run again, and × only dismisses.
 */
export function WinnerDialog({
  name,
  kicker,
  amount,
  amountLabel,
  payLabel,
  respinLabel,
  closeLabel,
  onPay,
  onRespin,
  onClose,
}: {
  name: string;
  kicker: string;
  amount?: string;
  amountLabel?: string;
  payLabel: string;
  respinLabel: string;
  closeLabel: string;
  onPay: () => void;
  onRespin: () => void;
  onClose: () => void;
}) {
  const payRef = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [pieces] = useState(makePieces);

  useEffect(() => {
    payRef.current?.focus();
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
        <button
          type="button"
          className="winner-x"
          aria-label={closeLabel}
          onClick={onClose}
        >
          ×
        </button>

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

        <div className="winner-actions">
          <button
            ref={payRef}
            type="button"
            className="button winner-pay"
            onClick={onPay}
          >
            {payLabel}
          </button>
          <button
            type="button"
            className="button ghost winner-respin"
            onClick={onRespin}
          >
            {respinLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
