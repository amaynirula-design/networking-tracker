'use client';

import { neon } from '@/lib/neon';
import type { ResolvedQuery } from './query';
import {
  parseContactInput,
  type Contact,
  type FieldErrors,
} from './schema';

/** An error carrying per-field messages so the form can render them inline. */
export class ContactError extends Error {
  readonly fieldErrors: FieldErrors;

  constructor(message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = 'ContactError';
    this.fieldErrors = fieldErrors;
  }
}

type PostgrestErrorish = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
} | null;

/**
 * Turn a Postgres/PostgREST failure into something a person can act on.
 *
 * These map the database's own defences — the CHECK constraints and the RLS
 * policies — back to the field that caused them. The database rejecting a value
 * is the expected path for a tampered client, not an unexpected crash.
 */
function toContactError(error: PostgrestErrorish, fallback: string): ContactError {
  const code = error?.code ?? '';
  const detail = `${error?.message ?? ''} ${error?.details ?? ''}`;

  // 23514 = check_violation: our CHECK constraints fired.
  if (code === '23514') {
    if (detail.includes('contacts_priority_valid')) {
      return new ContactError('Priority must be one of: high, medium, low.', {
        priority: 'Priority must be one of: high, medium, low.',
      });
    }
    if (detail.includes('contacts_name_not_blank')) {
      return new ContactError('Name is required.', { name: 'Name is required.' });
    }
    if (detail.includes('contacts_name_len')) {
      return new ContactError('Name must be 120 characters or fewer.', {
        name: 'Name must be 120 characters or fewer.',
      });
    }
    if (detail.includes('contacts_met_on_range')) {
      return new ContactError('That date met is out of range.', {
        met_on: 'Enter a date between 1900 and 2100.',
      });
    }
    if (detail.includes('contacts_follow_up_on_range')) {
      return new ContactError('That follow-up date is out of range.', {
        follow_up_on: 'Enter a date between 1900 and 2100.',
      });
    }
    return new ContactError('That value is not allowed by the database.');
  }

  // 42501 = insufficient_privilege: an RLS policy refused the row.
  if (code === '42501') {
    return new ContactError(
      'You can only create or edit contacts that belong to you.',
    );
  }

  // 22007/22008 = invalid date value reached Postgres despite client validation.
  if (code === '22007' || code === '22008') {
    return new ContactError('Please enter dates as a valid calendar date.');
  }

  // 23502 = not_null_violation: user_id was NULL, i.e. no valid session.
  if (code === '23502') {
    return new ContactError('Your session has expired. Please sign in again.');
  }

  return new ContactError(error?.message?.trim() || fallback);
}

/** Fetch the signed-in user's contacts. RLS scopes this to them; we never filter by user_id here. */
export async function listContacts(query: ResolvedQuery): Promise<Contact[]> {
  let request = neon.from('contacts').select('*');

  if (query.orFilter) request = request.or(query.orFilter);
  if (query.priority) request = request.eq('priority', query.priority);
  if (query.dueOnOrBefore) {
    // Due = has a follow-up date, and it is today or already past.
    request = request
      .not('follow_up_on', 'is', null)
      .lte('follow_up_on', query.dueOnOrBefore);
  }

  const { data, error } = await request
    .order(query.orderColumn, {
      ascending: query.ascending,
      nullsFirst: query.nullsFirst,
    })
    .order('created_at', { ascending: false });

  if (error) throw toContactError(error, 'Could not load your contacts.');
  return (data ?? []) as Contact[];
}

/**
 * Contacts whose follow-up is today or already past.
 *
 * Deliberately a separate query from the main list: the reminder count must
 * reflect everything you owe, not whatever the current search happens to match.
 */
export async function listDueFollowUps(today: string): Promise<Contact[]> {
  const { data, error } = await neon
    .from('contacts')
    .select('*')
    .not('follow_up_on', 'is', null)
    .lte('follow_up_on', today)
    .order('follow_up_on', { ascending: true });

  if (error) throw toContactError(error, 'Could not load your follow-ups.');
  return (data ?? []) as Contact[];
}

export async function createContact(raw: unknown): Promise<Contact> {
  const parsed = parseContactInput(raw);
  if (!parsed.success) {
    throw new ContactError('Please fix the highlighted fields.', parsed.errors);
  }

  // user_id is deliberately omitted: the column defaults to auth.user_id(), so
  // the browser cannot choose an owner even if this code were tampered with.
  const { data, error } = await neon
    .from('contacts')
    .insert(parsed.data)
    .select()
    .single();

  if (error) throw toContactError(error, 'Could not save this contact.');
  return data as Contact;
}

export async function updateContact(id: string, raw: unknown): Promise<Contact> {
  const parsed = parseContactInput(raw);
  if (!parsed.success) {
    throw new ContactError('Please fix the highlighted fields.', parsed.errors);
  }

  const { data, error } = await neon
    .from('contacts')
    .update(parsed.data)
    .eq('id', id)
    .select();

  if (error) throw toContactError(error, 'Could not update this contact.');

  // RLS filters other users' rows out of the UPDATE rather than raising: zero
  // rows back means the row is not ours (or no longer exists).
  if (!data || data.length === 0) {
    throw new ContactError('That contact could not be found in your list.');
  }
  return data[0] as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const { data, error } = await neon
    .from('contacts')
    .delete()
    .eq('id', id)
    .select();

  if (error) throw toContactError(error, 'Could not delete this contact.');
  if (!data || data.length === 0) {
    throw new ContactError('That contact could not be found in your list.');
  }
}
