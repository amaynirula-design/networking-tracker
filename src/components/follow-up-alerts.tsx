'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Bell, BellRing, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { followUpLabel, type Contact } from '@/lib/contacts/schema';

const STORAGE_KEY = 'nt:last-followup-reminder';

type Permission = 'unsupported' | 'default' | 'granted' | 'denied';

/**
 * `Notification.permission` is browser state, not React state, so it is read
 * through useSyncExternalStore rather than copied into a useState during an
 * effect. That keeps the server and client renders consistent and avoids a
 * cascading render on mount.
 */
const permissionListeners = new Set<() => void>();

function subscribePermission(onChange: () => void) {
  permissionListeners.add(onChange);
  return () => {
    permissionListeners.delete(onChange);
  };
}

/** Called after requestPermission resolves, since the browser fires no event. */
function notifyPermissionChanged() {
  for (const listener of permissionListeners) listener();
}

function permissionSnapshot(): Permission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as Permission;
}

/** There is no Notification API during server rendering. */
function permissionServerSnapshot(): Permission {
  return 'unsupported';
}

/**
 * Follow-up reminders.
 *
 * Two layers, and it is worth being precise about the difference:
 *
 *  - The banner is the reliable one. It is rendered from the data every time
 *    the page loads, so what you owe is always visible.
 *  - The browser notification is a convenience on top. It can only fire while
 *    this page is open, because the app is a static front end with no server
 *    process and no service worker. Real push — arriving when the app is
 *    closed — needs a scheduled job server-side; see the README's limitations.
 *
 * The notification is fired at most once per calendar day per browser, tracked
 * in localStorage, so reloading does not produce a stream of duplicates.
 */
export function FollowUpAlerts({
  due,
  today,
  onShowDue,
}: {
  due: Contact[];
  today: string;
  onShowDue: () => void;
}) {
  const permission = useSyncExternalStore(
    subscribePermission,
    permissionSnapshot,
    permissionServerSnapshot,
  );

  useEffect(() => {
    if (permission !== 'granted' || due.length === 0) return;

    let alreadyToday = false;
    try {
      alreadyToday = window.localStorage.getItem(STORAGE_KEY) === today;
    } catch {
      // Private browsing can throw on access; a duplicate reminder is a much
      // smaller problem than a crash, so carry on.
    }
    if (alreadyToday) return;

    const names = due.slice(0, 3).map((c) => c.name).join(', ');
    const extra = due.length > 3 ? ` and ${due.length - 3} more` : '';

    try {
      new Notification(
        due.length === 1
          ? 'You have a follow-up due'
          : `You have ${due.length} follow-ups due`,
        { body: `${names}${extra}`, tag: 'networking-tracker-followups' },
      );
      window.localStorage.setItem(STORAGE_KEY, today);
    } catch {
      // Notification construction can fail (e.g. unsupported in this context).
    }
  }, [permission, due, today]);

  async function enableReminders() {
    if (!('Notification' in window)) return;
    try {
      await Notification.requestPermission();
    } catch {
      // Permission stays whatever the browser reports.
    } finally {
      notifyPermissionChanged();
    }
  }

  if (due.length === 0) return null;

  const headline =
    due.length === 1
      ? `Follow up with ${due[0]?.name}`
      : `${due.length} follow-ups need attention`;

  const detail =
    due.length === 1
      ? followUpLabel(due[0]?.follow_up_on ?? null, today)
      : due
          .slice(0, 3)
          .map((c) => c.name)
          .join(', ') + (due.length > 3 ? `, +${due.length - 3} more` : '');

  return (
    <div
      role="status"
      className="border-priority-medium/30 bg-priority-medium-bg/60 animate-rise flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3"
    >
      <span className="bg-priority-medium/15 flex size-9 shrink-0 items-center justify-center rounded-xl">
        <CalendarClock className="text-priority-medium size-4.5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{headline}</p>
        {detail && (
          <p className="text-muted-foreground truncate text-xs">{detail}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {permission === 'default' && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={enableReminders}
            title="Show a browser notification when follow-ups are due"
          >
            <Bell className="size-4" />
            <span className="hidden sm:inline">Remind me</span>
          </Button>
        )}
        {permission === 'granted' && (
          <span
            className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:flex"
            title="Reminders appear while this page is open"
          >
            <BellRing className="size-3.5" aria-hidden />
            Reminders on
          </span>
        )}
        <Button size="sm" variant="outline" onClick={onShowDue}>
          Show these
        </Button>
      </div>
    </div>
  );
}
