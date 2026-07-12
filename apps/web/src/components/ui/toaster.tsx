'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { dismissToast, getToasts, subscribeToasts, type ToastItem, type ToastVariant } from './toast-store';

import { cn } from '@/lib/utils';


const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const PANEL_STYLES: Record<ToastVariant, string> = {
  success: 'border-primary/30 bg-primary-soft text-primary-deep',
  error: 'border-danger/30 bg-danger/10 text-danger',
  info: 'border-border bg-surface text-text',
};

const ICON_STYLES: Record<ToastVariant, string> = {
  success: 'text-primary-deep',
  error: 'text-danger',
  info: 'text-muted',
};

/** Mount once near the root — call `toast({ title, description, variant })` from anywhere to show one. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    setItems(getToasts());
    return subscribeToasts(setItems);
  }, []);

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={6000}>
      {items.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <ToastPrimitive.Root
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4 shadow-elevated',
              'data-[state=open]:animate-fade-up',
              'data-[state=closed]:animate-[fade-up_0.2s_ease-in_reverse]',
              'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
              'data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform',
              PANEL_STYLES[t.variant],
            )}
            onOpenChange={(open) => {
              if (!open) dismissToast(t.id);
            }}
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_STYLES[t.variant])} />
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-sm font-semibold">{t.title}</ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="mt-0.5 text-sm opacity-90">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close aria-label="Dismiss" className="shrink-0 rounded-md p-1 opacity-60 transition hover:opacity-100">
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="fixed inset-x-0 bottom-0 z-[100] mx-auto flex w-full max-w-[calc(100%-2rem)] flex-col gap-2 p-4 outline-none sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-sm" />
    </ToastPrimitive.Provider>
  );
}
