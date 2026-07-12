export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts(): ToastItem[] {
  return toasts;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(input: { title: string; description?: string; variant?: ToastVariant }): void {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  toasts = [...toasts, { id, variant: input.variant ?? 'info', title: input.title, description: input.description }];
  emit();
}
