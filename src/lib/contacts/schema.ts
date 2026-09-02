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
