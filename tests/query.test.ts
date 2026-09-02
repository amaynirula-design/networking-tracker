import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY,
  buildContactQuery,
  escapeFilterValue,
  isFiltered,
} from '@/lib/contacts/query';

describe('buildContactQuery — defaults', () => {
  it('falls back to newest-first when given nothing', () => {
    expect(buildContactQuery()).toEqual(DEFAULT_QUERY);
  });

  it('ignores an unknown sort field instead of trusting it', () => {
    const q = buildContactQuery({ sort: 'password' });
    expect(q.sort).toBe('created_at');
    expect(q.orderColumn).toBe('created_at');
  });

  it('ignores an unknown priority filter', () => {
    expect(buildContactQuery({ priority: 'urgent' }).priority).toBeNull();
  });

  it('treats any direction other than asc as desc', () => {
    expect(buildContactQuery({ direction: 'asc' }).ascending).toBe(true);
    expect(buildContactQuery({ direction: 'desc' }).ascending).toBe(false);
    expect(buildContactQuery({ direction: 'sideways' }).ascending).toBe(false);
  });
});

describe('buildContactQuery — sorting', () => {
  it('maps priority onto the generated rank column, not the text column', () => {
    // Alphabetical order on `priority` would be high, low, medium — wrong.
    const q = buildContactQuery({ sort: 'priority', direction: 'asc' });
    expect(q.orderColumn).toBe('priority_rank');
    expect(q.ascending).toBe(true);
  });

  it('passes through plain columns unchanged', () => {
    expect(buildContactQuery({ sort: 'name' }).orderColumn).toBe('name');
    expect(buildContactQuery({ sort: 'company' }).orderColumn).toBe('company');
  });
});

describe('buildContactQuery — search', () => {
  it('produces no filter for a blank search', () => {
    expect(buildContactQuery({ search: '   ' }).orFilter).toBeNull();
    expect(buildContactQuery({ search: '' }).search).toBeNull();
  });

  it('searches name, company, role and met_at with wildcards', () => {
    const q = buildContactQuery({ search: 'haas' });
    expect(q.orFilter).toBe(
      'name.ilike."*haas*",company.ilike."*haas*",role.ilike."*haas*",met_at.ilike."*haas*"',
    );
  });

  it('trims the search term', () => {
    expect(buildContactQuery({ search: '  haas  ' }).search).toBe('haas');
  });
});

describe('escapeFilterValue — PostgREST grammar safety', () => {
  it('quotes commas so they cannot split a filter into extra clauses', () => {
    // Unescaped, `a,b` would be read as two separate PostgREST conditions.
    expect(escapeFilterValue('a,b')).toBe('"a,b"');
  });

  it('escapes embedded double quotes and backslashes', () => {
    expect(escapeFilterValue('say "hi"')).toBe('"say \\"hi\\""');
    expect(escapeFilterValue('back\\slash')).toBe('"back\\\\slash"');
  });

  it('keeps a crafted term inside a single clause', () => {
    const q = buildContactQuery({ search: 'x,user_id.neq.zzz' });
    // The whole term stays quoted, so it cannot inject a second condition.
    expect(q.orFilter).toContain('name.ilike."*x,user_id.neq.zzz*"');
    expect(q.orFilter?.split('.ilike.')).toHaveLength(5);
  });
});

describe('isFiltered', () => {
  it('is false for the default view', () => {
    expect(isFiltered(DEFAULT_QUERY)).toBe(false);
  });

  it('is true once a search or priority filter is applied', () => {
    expect(isFiltered(buildContactQuery({ search: 'ada' }))).toBe(true);
    expect(isFiltered(buildContactQuery({ priority: 'high' }))).toBe(true);
  });
});
