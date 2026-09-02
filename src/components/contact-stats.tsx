'use client';

import { Building2, CalendarClock, Flame, Users } from 'lucide-react';
import type { Contact } from '@/lib/contacts/schema';

/**
 * Summary tiles derived from the rows currently on screen.
 *
 * These count what is displayed, not the whole table — the list is fetched
 * already filtered — so the first label switches to "Matching" when a filter is
 * active rather than implying a total it isn't measuring.
 */
export function ContactStats({
  contacts,
  filtered,
  dueCount,
}: {
  contacts: Contact[];
  filtered: boolean;
  /** Counted across the whole list, not just what is on screen. */
  dueCount: number;
}) {
  const high = contacts.filter((c) => c.priority === 'high').length;
  const companies = new Set(
    contacts.map((c) => c.company?.trim().toLowerCase()).filter(Boolean),
  ).size;

  const tiles = [
    {
      icon: Users,
      label: filtered ? 'Matching' : 'Contacts',
      value: contacts.length,
      tint: 'text-brand',
    },
    { icon: Flame, label: 'High priority', value: high, tint: 'text-priority-high' },
    {
      icon: CalendarClock,
      label: 'Due now',
      value: dueCount,
      tint: 'text-priority-medium',
    },
    { icon: Building2, label: 'Companies', value: companies, tint: 'text-priority-low' },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
      {tiles.map(({ icon: Icon, label, value, tint }, i) => (
        <div
          key={label}
          className="border-border/70 bg-card animate-rise rounded-xl border p-3 shadow-sm sm:p-4"
          style={{ '--i': i } as React.CSSProperties}
        >
          <dt className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase sm:text-xs">
            <Icon className={`size-3.5 ${tint}`} aria-hidden />
            <span className="truncate">{label}</span>
          </dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
