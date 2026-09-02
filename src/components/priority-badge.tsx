import { Badge } from '@/components/ui/badge';
import { PRIORITY_LABELS, type Priority } from '@/lib/contacts/schema';
import { cn } from '@/lib/utils';

/** Colour carries meaning here, so the label always accompanies it. */
const STYLES: Record<Priority, string> = {
  high: 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
  medium:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  low: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant="outline" className={cn('font-medium', STYLES[priority])}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
