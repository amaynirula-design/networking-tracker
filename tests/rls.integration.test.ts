/**
 * Two-account privacy proof, run against a real Neon project.
 *
 * This is the assignment's "User A cannot read or change User B's contacts"
 * requirement, executed rather than screenshotted. It deliberately talks to the
 * Data API over HTTPS exactly as the browser does — same endpoint, same JWTs —
 * so what it proves is the real production security boundary, not a mock.
 *
 * Skipped automatically unless the four TEST_USER_* variables are set, so
 * `npm test` still passes in a fresh clone with no credentials.
 *
 * Setup: create two accounts through the app's own sign-up page, put their
 * credentials in .env.local (gitignored), then run `npm run test:rls`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@neondatabase/neon-js';

const AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const DATA_API_URL = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;
const A_EMAIL = process.env.TEST_USER_A_EMAIL;
const A_PASSWORD = process.env.TEST_USER_A_PASSWORD;
const B_EMAIL = process.env.TEST_USER_B_EMAIL;
const B_PASSWORD = process.env.TEST_USER_B_PASSWORD;

const configured = Boolean(
  AUTH_URL && DATA_API_URL && A_EMAIL && A_PASSWORD && B_EMAIL && B_PASSWORD,
);

if (!configured) {
  console.warn(
    '\n[rls] Skipped: set NEXT_PUBLIC_NEON_* and TEST_USER_A/B_* in .env.local to run the two-account privacy test.\n',
  );
}

/**
 * Origin that Better Auth will accept. Node's fetch sends no `Origin` header,
 * unlike a browser, and Better Auth rejects such requests outright with
 * MISSING_OR_NULL_ORIGIN — so we send one explicitly. It must be listed in the
 * project's trusted origins, which is the same allow-list the deployed app
 * relies on.
 */
const ORIGIN = process.env.TEST_ORIGIN ?? 'http://localhost:3000';

/**
 * Sign-in is memoised per account.
 *
 * Two suites in this file both need User A. Signing in twice concurrently was
 * intermittently rejected by the auth service, which made the run flaky — so
 * each account authenticates at most once per test run and the promise is
 * shared.
 */
const sessions = new Map<string, Promise<string>>();

function signIn(email: string, password: string): Promise<string> {
  const cached = sessions.get(email);
  if (cached) return cached;
  const pending = doSignIn(email, password);
  sessions.set(email, pending);
  return pending;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sign in over HTTP and exchange the session cookie for a Data API JWT.
 *
 * Better Auth rate-limits sign-in, so running this suite several times in quick
 * succession can return 429. That is the service behaving correctly, not a test
 * failure, so back off and retry rather than reporting a spurious break.
 */
async function doSignIn(email: string, password: string): Promise<string> {
  const backoffMs = [2_000, 5_000, 10_000];
  let res!: Response;

  for (let attempt = 0; ; attempt++) {
    res = await fetch(`${AUTH_URL}/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email, password }),
    });
    if (res.status !== 429 || attempt >= backoffMs.length) break;
    await sleep(backoffMs[attempt]);
  }

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) {
      throw new Error(
        `Sign-in for ${email} is still rate-limited after ${backoffMs.length} retries. ` +
          `Wait a minute and re-run. Response: ${body}`,
      );
    }
    throw new Error(`Sign-in failed for ${email} (${res.status}): ${body}`);
  }

  // Node has no cookie jar, so carry the session cookie forward by hand.
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

  const tokenRes = await fetch(`${AUTH_URL}/token`, {
    headers: { cookie, origin: ORIGIN },
  });
  if (!tokenRes.ok) {
    throw new Error(
      `Token exchange failed for ${email} (${tokenRes.status}): ${await tokenRes.text()}`,
    );
  }
  const body = (await tokenRes.json()) as { token?: string };
  if (!body.token) throw new Error(`No token returned for ${email}`);
  return body.token;
}

/** The `sub` claim is what Postgres sees as auth.user_id(). */
function subjectOf(jwt: string): string {
  const payload = JSON.parse(
    Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'),
  ) as { sub: string };
  return payload.sub;
}

/** A Data API client bound to one specific user's JWT. */
function clientFor(jwt: string) {
  return createClient({
    dataApi: { url: DATA_API_URL!, getToken: async () => jwt },
  });
}

describe.skipIf(!configured)('RLS — User A vs User B', () => {
  let alice: ReturnType<typeof clientFor>;
  let bob: ReturnType<typeof clientFor>;
  let aliceId: string;
  let bobId: string;
  let aliceContactId: string;

  beforeAll(async () => {
    const [aliceJwt, bobJwt] = await Promise.all([
      signIn(A_EMAIL!, A_PASSWORD!),
      signIn(B_EMAIL!, B_PASSWORD!),
    ]);
    aliceId = subjectOf(aliceJwt);
    bobId = subjectOf(bobJwt);
    expect(aliceId).not.toBe(bobId);

    alice = clientFor(aliceJwt);
    bob = clientFor(bobJwt);

    const { data, error } = await alice
      .from('contacts')
      .insert({
        name: 'RLS Fixture — Alice private contact',
        company: 'Confidential Co',
        role: 'Secret Keeper',
        met_at: 'Nowhere Bob can see',
        notes: 'If Bob can read this, RLS is broken.',
        priority: 'high',
      })
      .select()
      .single();

    if (error) throw new Error(`Fixture insert failed: ${error.message}`);
    aliceContactId = (data as { id: string }).id;
  }, 30_000);

  afterAll(async () => {
    if (alice && aliceContactId) {
      await alice.from('contacts').delete().eq('id', aliceContactId);
    }
  });

  it("defaults user_id to the caller's own auth.user_id()", async () => {
    // The client never sends user_id; the column default supplies it.
    const { data } = await alice
      .from('contacts')
      .select('user_id')
      .eq('id', aliceContactId)
      .single();
    expect((data as { user_id: string }).user_id).toBe(aliceId);
  });

  it('does not leak the row into an unfiltered list for the other user', async () => {
    // No .eq() here on purpose: RLS alone must do the filtering.
    const { data, error } = await bob.from('contacts').select('*');
    expect(error).toBeNull();
    const ids = (data ?? []).map((row) => (row as { id: string }).id);
    expect(ids).not.toContain(aliceContactId);
  });

  it('returns nothing when the other user asks for the row by id', async () => {
    const { data, error } = await bob
      .from('contacts')
      .select('*')
      .eq('id', aliceContactId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("refuses to update another user's row", async () => {
    const { data } = await bob
      .from('contacts')
      .update({ name: 'Bob was here' })
      .eq('id', aliceContactId)
      .select();
    // The UPDATE policy's USING clause hides the row, so zero rows change.
    expect(data ?? []).toEqual([]);

    const { data: after } = await alice
      .from('contacts')
      .select('name')
      .eq('id', aliceContactId)
      .single();
    expect((after as { name: string }).name).toBe(
      'RLS Fixture — Alice private contact',
    );
  });

  it("refuses to delete another user's row", async () => {
    const { data } = await bob
      .from('contacts')
      .delete()
      .eq('id', aliceContactId)
      .select();
    expect(data ?? []).toEqual([]);

    const { data: stillThere } = await alice
      .from('contacts')
      .select('id')
      .eq('id', aliceContactId);
    expect(stillThere).toHaveLength(1);
  });

  it('refuses an insert that claims another user as the owner', async () => {
    // The INSERT policy's WITH CHECK clause rejects this outright.
    const { error } = await bob
      .from('contacts')
      .insert({ name: 'Planted by Bob', priority: 'low', user_id: aliceId })
      .select();
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('refuses to hand your own row to someone else', async () => {
    const { data: mine, error: insertError } = await bob
      .from('contacts')
      .insert({ name: 'Bob transfer test', priority: 'low' })
      .select()
      .single();
    expect(insertError).toBeNull();
    const bobContactId = (mine as { id: string }).id;

    try {
      // This is the UPDATE policy's WITH CHECK clause doing its job.
      const { error } = await bob
        .from('contacts')
        .update({ user_id: aliceId })
        .eq('id', bobContactId)
        .select();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('42501');

      const { data: unchanged } = await bob
        .from('contacts')
        .select('user_id')
        .eq('id', bobContactId)
        .single();
      expect((unchanged as { user_id: string }).user_id).toBe(bobId);
    } finally {
      await bob.from('contacts').delete().eq('id', bobContactId);
    }
  });
});

describe.skipIf(!configured)('Database-level validation', () => {
  let alice: ReturnType<typeof clientFor>;

  beforeAll(async () => {
    alice = clientFor(await signIn(A_EMAIL!, A_PASSWORD!));
  }, 30_000);

  it('rejects an invalid priority even when the client is bypassed', async () => {
    // Straight to the Data API, skipping the app's Zod schema entirely — this
    // is what a tampered browser would send. The CHECK constraint stops it.
    const { error } = await alice
      .from('contacts')
      .insert({ name: 'Invalid priority', priority: 'urgent' })
      .select();
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
    expect(`${error?.message} ${error?.details ?? ''}`).toContain(
      'contacts_priority_valid',
    );
  });

  it('rejects a blank name even when the client is bypassed', async () => {
    const { error } = await alice
      .from('contacts')
      .insert({ name: '   ', priority: 'low' })
      .select();
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
    expect(`${error?.message} ${error?.details ?? ''}`).toContain(
      'contacts_name_not_blank',
    );
  });
});

describe.skipIf(!configured)('Anonymous access', () => {
  it('refuses to read contacts without a token', async () => {
    const anonymous = createClient({
      dataApi: { url: DATA_API_URL!, getToken: async () => null },
    });
    const { data, error } = await anonymous.from('contacts').select('*');
    // Either an explicit error or an empty set is acceptable; leaking rows is not.
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});
