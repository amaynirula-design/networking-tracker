'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { BrandWordmark } from '@/components/brand';
import { ContactAvatar } from '@/components/contact-avatar';
import { ContactStats } from '@/components/contact-stats';
import { FollowUpAlerts } from '@/components/follow-up-alerts';
import { ContactFilters, type FilterState } from '@/components/contact-filters';
import { ContactFormDialog } from '@/components/contact-form-dialog';
import { ContactList } from '@/components/contact-list';
import { SetupNotice } from '@/components/setup-notice';
import {
  ContactsLoading,
  EmptyState,
  ErrorState,
  PageLoading,
} from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  createContact,
  deleteContact,
  listContacts,
  listDueFollowUps,
  updateContact,
} from '@/lib/contacts/api';
import { buildContactQuery, isFiltered } from '@/lib/contacts/query';
import { todayIso, type Contact } from '@/lib/contacts/schema';
import { isNeonConfigured, neon } from '@/lib/neon';

const INITIAL_FILTERS: FilterState = {
  search: '',
  priority: 'all',
  sort: 'created_at',
  direction: 'desc',
  dueOnly: false,
};

export default function ContactsPage() {
  const router = useRouter();
  const session = neon.auth.useSession();

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Computed once per mount. The app is not long-lived enough for the date to
  // roll over mid-session, and keeping it in state makes every dependent
  // calculation deterministic.
  const [today] = useState(() => todayIso());

  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [due, setDue] = useState<Contact[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  // Bumped on every open so the form dialog remounts with fresh state.
  const [dialogKey, setDialogKey] = useState(0);
  // Bumped whenever the list needs re-fetching after a mutation or a retry.
  const [reloadToken, setReloadToken] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  const signedIn = Boolean(session.data);

  // Send signed-out visitors to the sign-in page.
  //
  // The store can report "settled, no session" for a moment right after a
  // successful sign-in, so confirm with an explicit read before bouncing
  // anyone out. Redirecting on the first null is what made sign-in appear to
  // fail on the first attempt.
  useEffect(() => {
    if (session.isPending || session.data) return;

    let cancelled = false;
    void (async () => {
      let confirmedSignedOut = true;
      try {
        const result = await neon.auth.getSession();
        const payload = (result ?? null) as { data?: unknown } | null;
        const settled = (payload?.data ?? payload) as { user?: unknown } | null;
        confirmedSignedOut = !settled?.user;
      } catch {
        confirmedSignedOut = true;
      }
      if (!cancelled && confirmedSignedOut) router.replace('/sign-in');
    })();

    return () => {
      cancelled = true;
    };
  }, [session.isPending, session.data, router]);

  // Typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const query = useMemo(
    () =>
      buildContactQuery({
        search: debouncedSearch,
        priority: filters.priority === 'all' ? null : filters.priority,
        sort: filters.sort,
        direction: filters.direction,
        dueOnly: filters.dueOnly,
        today,
      }),
    [
      debouncedSearch,
      filters.priority,
      filters.sort,
      filters.direction,
      filters.dueOnly,
      today,
    ],
  );

  // Fetching lives entirely in this effect. Mutations and the retry button
  // request a refresh by bumping `reloadToken` rather than calling a fetcher
  // directly, which keeps a single owner for the request lifecycle.
  useEffect(() => {
    if (!signedIn) return;

    // Guards against out-of-order responses: the debounced search can leave two
    // requests in flight, and without this the slower one could overwrite the
    // newer results.
    let cancelled = false;

    void (async () => {
      try {
        // Sorting and filtering happen in Postgres, not in the browser, so they
        // keep working as the list grows. The previous list stays on screen
        // while a new query is in flight, so typing doesn't flash the table
        // back to skeletons on every keystroke.
        const rows = await listContacts(query);
        if (cancelled) return;
        setContacts(rows);
        setLoadError(null);

        // Independent of the current filters: this is everything you owe.
        try {
          const dueRows = await listDueFollowUps(today);
          if (!cancelled) setDue(dueRows);
        } catch {
          // A failed reminder count should never blank the contact list.
        }
      } catch (caught) {
        if (cancelled) return;
        setContacts(null);
        setLoadError(
          caught instanceof Error
            ? caught.message
            : 'Could not load your contacts.',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn, query, reloadToken, today]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  function openCreate() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  async function handleSubmit(draft: unknown) {
    if (editing) {
      await updateContact(editing.id, draft);
      toast.success('Contact updated');
    } else {
      await createContact(draft);
      toast.success('Contact added');
    }
    reload();
  }

  async function handleDelete(contact: Contact) {
    try {
      await deleteContact(contact.id);
      toast.success(`Deleted ${contact.name}`);
      reload();
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not delete this contact.',
      );
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await neon.auth.signOut();
      router.replace('/sign-in');
    } catch {
      toast.error('Could not sign out. Please try again.');
      setSigningOut(false);
    }
  }

  if (!isNeonConfigured) return <SetupNotice />;
  if (session.isPending) return <PageLoading label="Checking your session…" />;
  if (!session.data) return <PageLoading label="Finishing sign in…" />;

  const user = session.data.user;
  const filtered = isFiltered(query);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <BrandWordmark />

          <div className="flex items-center gap-2">
            <span className="border-border/70 bg-card hidden items-center gap-2 rounded-full border py-1 pr-3 pl-1 sm:flex">
              <ContactAvatar name={user.name || user.email} className="size-7 text-[11px]" />
              <span className="text-muted-foreground max-w-[14rem] truncate text-xs">
                {user.email}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">
                {signingOut ? 'Signing out…' : 'Sign out'}
              </span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:py-8">
        <div className="flex items-end justify-between gap-3">
          <div className="animate-rise">
            <h1 className="text-brand-gradient text-2xl font-semibold tracking-tight sm:text-3xl">
              Your contacts
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {contacts === null
                ? 'Loading your list…'
                : contacts.length === 0
                  ? filtered
                    ? 'Nothing matches those filters yet.'
                    : 'Nobody here yet — add the first person you met.'
                  : `${contacts.length} ${contacts.length === 1 ? 'person' : 'people'}${
                      filtered ? ' matching your filters' : ' worth staying in touch with'
                    }.`}
            </p>
          </div>
          <Button onClick={openCreate} className="group shrink-0 shadow-sm">
            <Plus className="size-4 transition-transform duration-200 group-hover:rotate-90" />
            <span className="hidden sm:inline">Add contact</span>
          </Button>
        </div>

        <FollowUpAlerts
          due={due}
          today={today}
          onShowDue={() =>
            setFilters({
              ...INITIAL_FILTERS,
              dueOnly: true,
              sort: 'follow_up_on',
              direction: 'asc',
            })
          }
        />

        {contacts !== null && contacts.length > 0 && (
          <ContactStats
            contacts={contacts}
            filtered={filtered}
            dueCount={due.length}
          />
        )}

        <ContactFilters
          value={filters}
          onChange={setFilters}
          disabled={contacts === null && loadError === null}
        />

        {loadError ? (
          <ErrorState message={loadError} onRetry={reload} />
        ) : contacts === null ? (
          <ContactsLoading />
        ) : contacts.length === 0 ? (
          filtered ? (
            <EmptyState
              filtered
              title="No contacts match those filters"
              description="Try a different search term, or clear the filters to see everyone on your list."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(INITIAL_FILTERS)}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No contacts yet"
              description="Add the first person you want to stay connected with — a name is all you need to start."
              action={
                <Button onClick={openCreate} className="group">
                  <Plus className="size-4 transition-transform duration-200 group-hover:rotate-90" />
                  Add your first contact
                </Button>
              }
            />
          )
        ) : (
          <ContactList
            contacts={contacts}
            today={today}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        )}
      </main>

      <ContactFormDialog
        key={dialogKey}
        open={dialogOpen}
        contact={editing}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
