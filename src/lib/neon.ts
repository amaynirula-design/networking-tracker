'use client';

import { createClient } from '@neondatabase/neon-js';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

/**
 * The single Neon client for the browser.
 *
 * This is the "two-URL object form": one URL for Managed Better Auth, one for
 * the Data API. The SDK attaches the signed-in user's JWT to every Data API
 * request automatically, and Postgres derives `auth.user_id()` from that
 * token's `sub` claim to enforce the RLS policies in `db/schema.sql`.
 *
 * Both URLs are public on purpose. Security does not come from hiding them —
 * it comes from RLS. There is no connection string in this bundle.
 */
const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;

/** False when the app was built without Neon URLs, so we can explain rather than crash. */
export const isNeonConfigured = Boolean(authUrl && dataApiUrl);

// Placeholders keep module initialisation total: a missing-config app still
// renders a setup screen instead of throwing before React mounts.
export const neon = createClient({
  auth: {
    url: authUrl ?? 'https://unconfigured.invalid/neondb/auth',
    adapter: BetterAuthReactAdapter(),
  },
  dataApi: {
    url: dataApiUrl ?? 'https://unconfigured.invalid/neondb/rest/v1',
  },
});
