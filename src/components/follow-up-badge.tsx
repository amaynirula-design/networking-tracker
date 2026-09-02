'use client';

import { AlertTriangle, CalendarClock, CalendarCheck } from 'lucide-react';
import {
  followUpLabel,
  followUpStatus,
  type FollowUpStatus,
} from '@/lib/contacts/schema';
import { cn } from '@/lib/utils';

const STYLES: Record<Exclude<FollowUpStatus, 'none'>, string> = {
  overdue:
    'bg-priority-high-bg text-priority-high ring-priority-high/25',
  today:
    'bg-priority-medium-bg text-priority-medium ring-priority-medium/30',
  soon: 'bg-priority-low-bg text-priority-low ring-priority-low/25',
  later: 'bg-muted text-muted-foreground ring-border',
};

const ICONS: Record<Exclude<FollowUpStatus, 'none'>, typeof CalendarClock> = {
  overdue: AlertTriangle,
  today: CalendarClock,
  soon: CalendarClock,
  later: CalendarCheck,
};

/**
 * Follow-up state as a badge. Renders nothing when there is no follow-up date,
 * so a contact you are not chasing stays visually quiet.
 */
export function FollowUpBadge({
  date,
  today,
  className,
}: {
  date: string | null;
  today: string;
  className?: string;
}) {
  const status = followUpStatus(date, today);
  if (status === 'none') return null;

  const label = followUpLabel(date, today);
  const Icon = ICONS[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        STYLES[status],
        status === 'overdue' && 'animate-sheen',
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
