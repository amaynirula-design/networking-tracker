import { z } from 'zod';

/**
 * The only three priorities the system accepts.
 *
 * This list is mirrored by the `contacts_priority_valid` CHECK constraint in
 * `db/schema.sql`. The database is the authority: this schema exists to give
 * the user a fast, clear error, not to be the last line of defence.
 */
export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** Earliest and latest dates the database will accept, mirrored by CHECK constraints. */
export const DATE_RANGE = { min: '1900-01-01', max: '2100-01-01' } as const;

/** Column length limits, mirrored by CHECK constraints in the database. */
export const LIMITS = {
  name: 120,
  company: 120,
  role: 120,
  met_at: 160,
  notes: 2000,
} as const;

/** Trim a string; treat blank as "not provided" so we store NULL, never ''. */
function blankToNull(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function optionalText(max: number, label: string) {
  return z.preprocess(
    blankToNull,
    z
      .string()
      .max(max, { error: `${label} must be ${max} characters or fewer.` })
      .nullable(),
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A calendar date as `YYYY-MM-DD`, or null.
 *
 * Stored as a Postgres `date` — deliberately not a timestamp. "The day I met
 * them" has no time zone; treating it as an instant would shift the date for
 * anyone travelling, which is exactly the class of bug that makes dates
 * miserable.
 */
/**
 * True only for a real calendar date in `YYYY-MM-DD` form.
 *
 * The round-trip is the important part: `new Date('2026-02-30T00:00:00Z')` does
 * NOT throw or return NaN — JavaScript silently rolls it over to 2 March. So a
 * regex plus a NaN check accepts dates that do not exist. Formatting the parsed
 * value back and comparing catches the rollover.
 */
function isRealCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function optionalDate(label: string) {
  return z.preprocess(
    blankToNull,
    z
      .string()
      .nullable()
      .refine((v) => v === null || isRealCalendarDate(v), {
        error: `${label} must be a valid date.`,
      })
      .refine((v) => v === null || (v >= DATE_RANGE.min && v <= DATE_RANGE.max), {
        error: `${label} must be between ${DATE_RANGE.min} and ${DATE_RANGE.max}.`,
      }),
  );
}

export const contactInputSchema = z.object({
  name: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z
      .string({ error: 'Name is required.' })
      .min(1, { error: 'Name is required.' })
      .max(LIMITS.name, {
        error: `Name must be ${LIMITS.name} characters or fewer.`,
      }),
  ),
  company: optionalText(LIMITS.company, 'Company'),
  role: optionalText(LIMITS.role, 'Role'),
  met_at: optionalText(LIMITS.met_at, 'Where you met'),
  met_on: optionalDate('Date met'),
  follow_up_on: optionalDate('Follow-up date'),
  notes: optionalText(LIMITS.notes, 'Notes'),
  priority: z.enum(PRIORITIES, {
    error: 'Priority must be one of: high, medium, low.',
  }),
});

/** Validated, database-ready shape. Keys match the `contacts` columns exactly. */
export type ContactInput = z.infer<typeof contactInputSchema>;

/** A row as returned by the Data API. */
export type Contact = ContactInput & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type FieldErrors = Partial<Record<keyof ContactInput | '_form', string>>;

export type ParseResult =
  | { success: true; data: ContactInput }
  | { success: false; errors: FieldErrors };

/**
 * Validate raw form input.
 *
 * Returns one message per field so the UI can render errors inline instead of
 * dumping a stack of Zod issues on the user.
 */
export function parseContactInput(raw: unknown): ParseResult {
  const result = contactInputSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = (issue.path[0] ?? '_form') as keyof FieldErrors;
    // Keep the first message per field; later issues are usually less specific.
    if (!errors[key]) errors[key] = issue.message;
  }
  return { success: false, errors };
}

/** Narrowing helper used by the UI and the tests. */
export function isPriority(value: unknown): value is Priority {
  return (
    typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value)
  );
}


/* -------------------------------------------------------------------------- */
/* Follow-ups                                                                 */
/* -------------------------------------------------------------------------- */

export type FollowUpStatus = 'overdue' | 'today' | 'soon' | 'later' | 'none';

/** Days from today that still counts as "soon". */
export const SOON_WINDOW_DAYS = 7;

/**
 * Today as `YYYY-MM-DD` in the viewer's own time zone.
 *
 * Deliberately not `toISOString()`, which converts to UTC first and so reports
 * tomorrow's date for anyone east of Greenwich in the evening — a follow-up
 * would look due a day early.
 */
export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whole days from `today` to `date`. Negative when the date has passed. */
export function daysUntil(date: string, today: string): number {
  const MS_PER_DAY = 86_400_000;
  const target = Date.parse(`${date}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(target) || Number.isNaN(start)) return Number.NaN;
  return Math.round((target - start) / MS_PER_DAY);
}

/** Bucket a follow-up date so the UI can colour and sort it. */
export function followUpStatus(
  date: string | null | undefined,
  today: string = todayIso(),
): FollowUpStatus {
  if (!date) return 'none';
  const days = daysUntil(date, today);
  if (Number.isNaN(days)) return 'none';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= SOON_WINDOW_DAYS) return 'soon';
  return 'later';
}

/** A follow-up needs action when it is due today or already past. */
export function isFollowUpDue(
  date: string | null | undefined,
  today: string = todayIso(),
): boolean {
  const status = followUpStatus(date, today);
  return status === 'overdue' || status === 'today';
}

/** Short human label, e.g. "3 days overdue", "Due today", "In 4 days". */
export function followUpLabel(
  date: string | null | undefined,
  today: string = todayIso(),
): string | null {
  if (!date) return null;
  const days = daysUntil(date, today);
  if (Number.isNaN(days)) return null;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return '1 day overdue';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  return `In ${days} days`;
}
