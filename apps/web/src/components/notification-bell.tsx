'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/lib/notifications';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch once on mount so the unread badge is accurate, then refetch only
  // when the user opens the dropdown. No background polling, no WebSocket.
  const { data, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: listNotifications,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) void refetch();
      return next;
    });
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggle}
        className="relative rounded-md p-2 transition hover:bg-primary-soft"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell className="h-5 w-5 text-text/70" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-primary-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 flex max-h-[28rem] w-80 flex-col rounded-lg border bg-bg shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await markAllNotificationsRead();
                  refresh();
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary-deep hover:bg-primary-soft"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">No notifications yet.</p>
            ) : (
              <ul>
                {items.map((n) => (
                  <NotificationRow key={n.id} n={n} onRead={refresh} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ n, onRead }: { n: NotificationItem; onRead: () => void }) {
  const unread = !n.readAt;
  return (
    <li
      className={cn(
        'cursor-pointer border-t px-3 py-2 text-sm transition hover:bg-primary-soft/30',
        unread && 'bg-primary-soft/40',
      )}
      onClick={async () => {
        if (unread) {
          await markNotificationRead(n.id);
          onRead();
        }
      }}
    >
      <div className="flex items-start gap-2">
        {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{n.title}</div>
          <div className="line-clamp-2 text-xs text-muted">{n.body}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
            {new Date(n.createdAt).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </div>
        </div>
      </div>
    </li>
  );
}
