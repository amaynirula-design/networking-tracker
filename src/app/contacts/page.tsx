'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Plus } from 'lucide-react';
import { toast } from 'sonner';
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
  updateContact,
} from '@/lib/contacts/api';
import { buildContactQuery, isFiltered } from '@/lib/contacts/query';
import type { Contact } from '@/lib/contacts/schema';
import { isNeonConfigured, neon } from '@/lib/neon';

const INITIAL_FILTERS: FilterState = {
  search: '',
  priority: 'all',
  sort: 'created_at',
  direction: 'desc',
};

export default function ContactsPage() {
  const router = useRouter();
  const session = neon.auth.useSession();

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [contacts, setContacts] = useState<Contact[] | null>(null);
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
  useEffect(() => {
    if (!session.isPending && !session.data) router.replace('/sign-in');
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
      }),
    [debouncedSearch, filters.priority, filters.sort, filters.direction],
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
  }, [signedIn, query, reloadToken]);

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
  if (!session.data) return <PageLoading label="Redirecting to sign in…" />;

  const user = session.data.user;
  const filtered = isFiltered(query);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-background border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">
              Networking Tracker
            </h1>
            <p className="text-muted-foreground truncate text-xs">
              Signed in as {user.email}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">
              {signingOut ? 'Signing out…' : 'Sign out'}
            </span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Your contacts</h2>
            <p className="text-muted-foreground text-sm">
              {contacts === null
                ? 'Loading…'
                : `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'}${
                    filtered ? ' matching your filters' : ''
                  }`}
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add contact</span>
          </Button>
        </div>

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
              description="Try a different search term or clear the filters to see everyone."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilters({ ...filters, search: '', priority: 'all' })
                  }
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No contacts yet"
              description="Add the first person you want to stay connected with, and they'll show up here."
              action={
                <Button onClick={openCreate}>
                  <Plus className="size-4" />
                  Add your first contact
                </Button>
              }
            />
          )
        ) : (
          <ContactList
            contacts={contacts}
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
