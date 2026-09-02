/**
 * Regenerate the README screenshots.
 *
 *   npm run screenshots
 *
 * Drives a real Chrome against a running dev server, signing in with the same
 * TEST_USER_* credentials the RLS suite uses (read from .env.local, which is
 * gitignored). Automated rather than hand-captured so the images can be
 * refreshed after any UI change instead of silently going stale.
 *
 * It seeds a small, fixed set of demo contacts on User A so every run produces
 * the same pictures. User B is left empty on purpose — that contrast is the
 * two-account privacy evidence.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'docs/screenshots';
const BASE = process.env.SCREENSHOT_URL ?? 'http://localhost:3000';
const DESKTOP = { width: 1360, height: 900 };
const MOBILE = { width: 390, height: 844 };

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {
    throw new Error('.env.local not found — copy .env.example and fill it in.');
  }
  return env;
}

const env = loadEnv();
const need = (k) => {
  const v = env[k] ?? process.env[k];
  if (!v) throw new Error(`Missing ${k} in .env.local`);
  return v;
};

/** Dates are relative to today so the follow-up badges never look stale. */
function iso(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

const DEMO = [
  {
    name: 'Priya Raman',
    company: 'Sequoia Capital',
    role: 'Partner, Growth',
    met_at: 'Haas AI mixer, Chou Hall',
    met_on: iso(-19),
    follow_up_on: iso(-5),
    notes: 'Runs the AI infra practice. Wants an intro to the Berkeley robotics lab.',
    priority: 'High',
  },
  {
    name: 'Aiko Tanaka',
    company: 'Stripe',
    role: 'Product Lead, Payments',
    met_at: 'Haas alumni coffee chat',
    met_on: iso(-6),
    follow_up_on: iso(0),
    notes: 'Hiring MBA interns for summer. Send resume in October.',
    priority: 'High',
  },
  {
    name: 'Daniel Okafor',
    company: 'Anthropic',
    role: 'Research Engineer',
    met_at: 'Berkeley AI Forum panel',
    met_on: iso(-1),
    follow_up_on: iso(3),
    notes: 'Talked about eval design. Offered to review my RLS write-up.',
    priority: 'Medium',
  },
  {
    name: 'Marcus Bell',
    company: '',
    role: '',
    met_at: 'Cal Rugby tailgate',
    met_on: '',
    follow_up_on: '',
    notes: '',
    priority: 'Low',
  },
];

async function signIn(page, email, password) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL('**/contacts', { timeout: 20_000 });
  await page.waitForSelector('text=Your contacts');
  await page.waitForTimeout(1200);
}


/** Fill the open dialog from a demo record and save. */
async function fillDialog(page, c) {
  const d = page.locator('[role=dialog]');
  await d.locator('#contact-name').fill(c.name);
  if (c.company) await d.locator('#contact-company').fill(c.company);
  if (c.role) await d.locator('#contact-role').fill(c.role);
  if (c.met_at) await d.locator('#contact-met-at').fill(c.met_at);
  if (c.met_on) await d.locator('#contact-met-on').fill(c.met_on);
  if (c.follow_up_on) await d.locator('#contact-follow-up-on').fill(c.follow_up_on);
  if (c.notes) await d.locator('#contact-notes').fill(c.notes);
  await d.locator('#contact-priority').click();
  await page.getByRole('option', { name: c.priority, exact: true }).click();
  await saveDialog(page, c.name);
}

/**
 * Submit the open dialog and wait for it to close.
 *
 * Retries once, because the first write after the database has been idle can
 * exceed the default timeout on a cold Neon compute. On a real failure the
 * dialog's own error text is surfaced instead of a bare selector timeout,
 * which otherwise says nothing about the cause.
 */
async function saveDialog(page, label) {
  const d = page.locator('[role=dialog]');
  for (let attempt = 1; attempt <= 2; attempt++) {
    await d.locator('button[type=submit]').click();
    try {
      await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 30_000 });
      await page.waitForTimeout(900);
      return;
    } catch (err) {
      const alerts = await d.locator('[role=alert]').allTextContents().catch(() => []);
      if (alerts.length) {
        throw new Error(`Saving "${label}" was rejected: ${alerts.join(' | ')}`);
      }
      if (attempt === 2) {
        throw new Error(`Saving "${label}" timed out with no error shown: ${err.message.split('\n')[0]}`);
      }
      await page.waitForTimeout(1500);
    }
  }
}

/**
 * Create the contact, or update it if it is already there.
 *
 * Updating matters: rows left over from earlier testing predate the date
 * columns, so merely skipping them produced screenshots with an empty
 * Follow-up column and "Due now 0" — the opposite of what these images are
 * meant to show.
 */
async function ensureContact(page, c) {
  const editButton = page.getByRole('button', { name: `Edit ${c.name}` }).first();
  if (await editButton.count()) {
    await editButton.click();
  } else {
    await page
      .getByRole('button', { name: /^Add contact$|Add your first contact/ })
      .first()
      .click();
  }
  await page.waitForSelector('[role=dialog]');
  await fillDialog(page, c);
}

async function seed(page) {
  for (const c of DEMO) await ensureContact(page, c);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
}

const shot = (page, name) =>
  page.screenshot({ path: join(OUT, name), animations: 'disabled' });

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });

  // ---- User A: the populated views ----
  const light = await browser.newContext({ viewport: DESKTOP, colorScheme: 'light', deviceScaleFactor: 2 });
  const page = await light.newPage();

  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await shot(page, '01-sign-in.png');

  await signIn(page, need('TEST_USER_A_EMAIL'), need('TEST_USER_A_PASSWORD'));
  await seed(page);
  await shot(page, '03-contact-list.png');

  // Add dialog, filled in.
  await page.getByRole('button', { name: /^Add contact$/ }).first().click();
  await page.waitForSelector('[role=dialog]');
  const d = page.locator('[role=dialog]');
  await d.locator('#contact-name').fill('Elena Vasquez');
  await d.locator('#contact-company').fill('Berkeley Lab');
  await d.locator('#contact-role').fill('Staff Scientist');
  await d.locator('#contact-met-at').fill('Cory Hall seminar');
  await d.locator('#contact-met-on').fill(iso(-2));
  await d.locator('#contact-follow-up-on').fill(iso(7));
  await d.locator('#contact-notes').fill('Interested in co-authoring the energy modelling paper.');
  await page.waitForTimeout(400);
  await shot(page, '04-add-contact.png');

  // Validation: clear the name and submit.
  await d.locator('#contact-name').fill('');
  await d.locator('button[type=submit]').click();
  await page.waitForSelector('text=Name is required.');
  await page.waitForTimeout(400);
  await shot(page, '05-validation-error.png');
  await d.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(600);

  // Filter + sort.
  await page.locator('#priority-filter').click();
  await page.getByRole('option', { name: 'High', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.locator('#sort-field').click();
  await page.getByRole('option', { name: 'Follow-up date', exact: true }).click();
  await page.waitForTimeout(1500);
  await shot(page, '06-filter-sort.png');

  // ---- Dark theme ----
  const dark = await browser.newContext({ viewport: DESKTOP, colorScheme: 'dark', deviceScaleFactor: 2 });
  const darkPage = await dark.newPage();
  await signIn(darkPage, need('TEST_USER_A_EMAIL'), need('TEST_USER_A_PASSWORD'));
  await shot(darkPage, '09-dark-mode.png');
  await dark.close();

  // ---- Mobile ----
  const mob = await browser.newContext({ viewport: MOBILE, colorScheme: 'light', deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mobPage = await mob.newPage();
  await signIn(mobPage, need('TEST_USER_A_EMAIL'), need('TEST_USER_A_PASSWORD'));
  await shot(mobPage, '07-mobile.png');
  await mob.close();

  // Clear the filters left over from the previous shot so this shows A's
  // whole list — it is the comparison against User B's empty one.
  await page.goto(`${BASE}/contacts`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, '08a-user-a.png');
  await light.close();

  // ---- User B: same URL, none of A's data ----
  const bCtx = await browser.newContext({ viewport: DESKTOP, colorScheme: 'light', deviceScaleFactor: 2 });
  const bPage = await bCtx.newPage();
  await signIn(bPage, need('TEST_USER_B_EMAIL'), need('TEST_USER_B_PASSWORD'));
  // One image, used for both the empty state and the User-B half of the
  // two-account comparison — they are genuinely the same view.
  await shot(bPage, '02-empty-state.png');
  await bCtx.close();

  await browser.close();
  console.log('Screenshots written to', OUT);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
