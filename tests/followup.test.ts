import { describe, expect, it } from 'vitest';
import {
  daysUntil,
  followUpLabel,
  followUpStatus,
  isFollowUpDue,
  parseContactInput,
  todayIso,
} from '@/lib/contacts/schema';

const TODAY = '2026-09-02';

const base = { name: 'Ada Lovelace', priority: 'medium' };

describe('date validation', () => {
  it('accepts a valid ISO date', () => {
    const result = parseContactInput({ ...base, met_on: '2026-08-14' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.met_on).toBe('2026-08-14');
  });

  it('treats a blank date as not provided rather than an error', () => {
    const result = parseContactInput({ ...base, met_on: '', follow_up_on: '  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.met_on).toBeNull();
      expect(result.data.follow_up_on).toBeNull();
    }
  });

  it('rejects an impossible calendar date that still matches the pattern', () => {
    // The regex alone would accept this; only real date parsing catches it.
    const result = parseContactInput({ ...base, met_on: '2026-02-30' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.met_on).toMatch(/valid date/);
  });

  it.each(['14/08/2026', '2026-8-14', 'August 14', '20260814', 'tomorrow'])(
    'rejects the malformed date %s',
    (value) => {
      const result = parseContactInput({ ...base, follow_up_on: value });
      expect(result.success).toBe(false);
    },
  );

  it('rejects dates outside the range the database will accept', () => {
    expect(parseContactInput({ ...base, met_on: '1823-05-01' }).success).toBe(false);
    expect(parseContactInput({ ...base, met_on: '2150-01-01' }).success).toBe(false);
  });
});

describe('daysUntil', () => {
  it('counts forward and backward from today', () => {
    expect(daysUntil('2026-09-02', TODAY)).toBe(0);
    expect(daysUntil('2026-09-03', TODAY)).toBe(1);
    expect(daysUntil('2026-09-01', TODAY)).toBe(-1);
    expect(daysUntil('2026-09-09', TODAY)).toBe(7);
  });

  it('crosses month and year boundaries correctly', () => {
    expect(daysUntil('2026-10-02', TODAY)).toBe(30);
    expect(daysUntil('2027-09-02', TODAY)).toBe(365);
  });
});

describe('followUpStatus', () => {
  it('buckets by distance from today', () => {
    expect(followUpStatus('2026-08-25', TODAY)).toBe('overdue');
    expect(followUpStatus('2026-09-02', TODAY)).toBe('today');
    expect(followUpStatus('2026-09-05', TODAY)).toBe('soon');
    expect(followUpStatus('2026-09-09', TODAY)).toBe('soon');
    expect(followUpStatus('2026-09-10', TODAY)).toBe('later');
  });

  it('reports none for a missing date', () => {
    expect(followUpStatus(null, TODAY)).toBe('none');
    expect(followUpStatus(undefined, TODAY)).toBe('none');
    expect(followUpStatus('', TODAY)).toBe('none');
  });
});

describe('isFollowUpDue', () => {
  it('is true only for today and the past', () => {
    expect(isFollowUpDue('2026-09-01', TODAY)).toBe(true);
    expect(isFollowUpDue('2026-09-02', TODAY)).toBe(true);
    expect(isFollowUpDue('2026-09-03', TODAY)).toBe(false);
    expect(isFollowUpDue(null, TODAY)).toBe(false);
  });
});

describe('followUpLabel', () => {
  it('reads naturally at the boundaries', () => {
    expect(followUpLabel('2026-09-02', TODAY)).toBe('Due today');
    expect(followUpLabel('2026-09-03', TODAY)).toBe('Due tomorrow');
    expect(followUpLabel('2026-09-01', TODAY)).toBe('1 day overdue');
    expect(followUpLabel('2026-08-28', TODAY)).toBe('5 days overdue');
    expect(followUpLabel('2026-09-06', TODAY)).toBe('In 4 days');
    expect(followUpLabel(null, TODAY)).toBeNull();
  });
});

describe('todayIso', () => {
  it('uses the local calendar day, not UTC', () => {
    // 22:30 on 2 Sep in a UTC+2 zone is still 2 Sep locally, but 20:30 UTC.
    // toISOString() would be right here, yet wrong at 01:00 local — so assert
    // the local components directly.
    const local = new Date(2026, 8, 2, 22, 30, 0);
    expect(todayIso(local)).toBe('2026-09-02');
  });

  it('does not roll over the date late in the evening', () => {
    const lateEvening = new Date(2026, 11, 31, 23, 59, 0);
    expect(todayIso(lateEvening)).toBe('2026-12-31');
  });
});
