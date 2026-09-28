import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export type MenuItem = {
  label: string;
  /** Renders a router link instead of a button. */
  to?: string;
  onSelect?: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
};

function itemClass(item: MenuItem): string {
  return `menu-item${item.tone === 'danger' ? ' danger' : ''}`;
}

/**
 * A three-dot button that opens a small popover of actions. Closes on outside
 * click and on Escape, and keeps the trigger labelled for screen readers.
 */
export function ActionMenu({
  label,
  items,
  emptyLabel = '—',
}: {
  label: string;
  items: MenuItem[];
  /** Shown when there is nothing this person may do. */
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) return <span className="muted">{emptyLabel}</span>;

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className={`menu-trigger${open ? ' open' : ''}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>
      {open ? (
        <div className="menu-pop" role="menu">
          {items.map((item, index) =>
            item.to ? (
              <Link
                key={`${item.label}-${index}`}
                role="menuitem"
                className={itemClass(item)}
                to={item.to}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={`${item.label}-${index}`}
                type="button"
                role="menuitem"
                className={itemClass(item)}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
