import { useEffect, useRef } from 'react';

/**
 * A blocking confirmation dialog for destructive actions. It is rendered over
 * the whole viewport, so it is always visible no matter how far the page is
 * scrolled, and it focuses the cancel button so a stray Enter cannot delete.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Kept in a ref so a re-render does not re-focus the button and steal focus.
  const cancel = useRef(onCancel);
  cancel.current = onCancel;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="title-lg">{title}</span>
        {body ? <span className="muted">{body}</span> : null}
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="button ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="button danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
