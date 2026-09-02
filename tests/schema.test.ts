import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  PRIORITIES,
  isPriority,
  parseContactInput,
} from '@/lib/contacts/schema';

const valid = {
  name: 'Ada Lovelace',
  company: 'Analytical Engines',
  role: 'Mathematician',
  met_at: 'Haas AI mixer',
  notes: 'Follow up about the Bernoulli project.',
  priority: 'high',
};

describe('parseContactInput — required fields', () => {
  it('accepts a fully populated contact', () => {
    const result = parseContactInput(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Ada Lovelace');
      expect(result.data.priority).toBe('high');
    }
  });

  it('rejects an empty name with a clear message', () => {
    const result = parseContactInput({ ...valid, name: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.name).toBe('Name is required.');
  });

  it('rejects a whitespace-only name', () => {
    const result = parseContactInput({ ...valid, name: '    ' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.name).toBe('Name is required.');
  });

  it('rejects a missing name', () => {
    const withoutName: Record<string, unknown> = { ...valid };
    delete withoutName.name;
    const result = parseContactInput(withoutName);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.name).toBe('Name is required.');
  });

  it('trims surrounding whitespace from the name', () => {
    const result = parseContactInput({ ...valid, name: '  Grace Hopper  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Grace Hopper');
  });

  it('rejects a name longer than the column limit', () => {
    const result = parseContactInput({ ...valid, name: 'x'.repeat(LIMITS.name + 1) });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.name).toMatch(/120 characters or fewer/);
  });
});

describe('parseContactInput — priority', () => {
  it.each(PRIORITIES)('accepts the valid priority %s', (priority) => {
    const result = parseContactInput({ ...valid, priority });
    expect(result.success).toBe(true);
  });

  it.each(['urgent', 'HIGH', 'High', '', null, undefined, 1, 'medium '])(
    'rejects the invalid priority %p',
    (priority) => {
      const result = parseContactInput({ ...valid, priority });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.priority).toBe(
          'Priority must be one of: high, medium, low.',
        );
      }
    },
  );

  it('does not silently coerce an unknown priority to a default', () => {
    const result = parseContactInput({ ...valid, priority: 'critical' });
    expect(result.success).toBe(false);
  });
});

describe('parseContactInput — optional fields', () => {
  it('stores blank optional fields as null rather than empty strings', () => {
    const result = parseContactInput({
      name: 'Solo Contact',
      company: '',
      role: '   ',
      met_at: undefined,
      notes: '',
      priority: 'low',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.company).toBeNull();
      expect(result.data.role).toBeNull();
      expect(result.data.met_at).toBeNull();
      expect(result.data.notes).toBeNull();
    }
  });

  it('reports every invalid field at once', () => {
    const result = parseContactInput({ name: '', priority: 'nope' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.name).toBeDefined();
      expect(result.errors.priority).toBeDefined();
    }
  });
});

describe('isPriority', () => {
  it('narrows only the three accepted values', () => {
    expect(isPriority('high')).toBe(true);
    expect(isPriority('medium')).toBe(true);
    expect(isPriority('low')).toBe(true);
    expect(isPriority('HIGH')).toBe(false);
    expect(isPriority(null)).toBe(false);
  });
});
