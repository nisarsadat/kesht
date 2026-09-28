import { useSyncExternalStore } from 'react';

export type ToastTone = 'success' | 'danger' | 'info';

type Toast = { id: number; message: string; tone: ToastTone };

/**
 * A tiny module-level toast store. Keeping it outside React means any action
 * handler can call notify(...) without threading a context through every page.
 */
let items: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Shows a short confirmation message; it disappears on its own. */
export function notify(message: string, tone: ToastTone = 'success'): void {
  const id = nextId++;
  items = [...items, { id, message, tone }];
  emit();
  globalThis.setTimeout(() => dismissToast(id), 3400);
}

export function dismissToast(id: number): void {
  const next = items.filter((toast) => toast.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Toast[] {
  return items;
}

/** Rendered once in the app shell, above every page. */
export function ToastHost() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast${toast.tone === 'success' ? '' : ` ${toast.tone}`}`}
          onClick={() => dismissToast(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
