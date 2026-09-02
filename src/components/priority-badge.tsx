import { PRIORITY_LABELS, type Priority } from '@/lib/contacts/schema';
import { cn } from '@/lib/utils';

/**
 * Colour carries meaning here, so the label always accompanies it and a filled
 * dot gives a second, non-colour cue.
 */
const STYLES: Record<Priority, string> = {
  high: 'bg-priority-high-bg text-priority-high ring-priority-high/25',
  medium: 'bg-priority-medium-bg text-priority-medium ring-priority-medium/25',
  low: 'bg-priority-low-bg text-priority-low ring-priority-low/25',
};

const DOTS: Record<Priority, string> = {
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        STYLES[priority],
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', DOTS[priority])} />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
