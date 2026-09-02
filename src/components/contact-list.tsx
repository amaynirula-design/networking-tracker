'use client';

import { useState } from 'react';
import { CalendarDays, MapPin, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ContactAvatar } from '@/components/contact-avatar';
import { FollowUpBadge } from '@/components/follow-up-badge';
import { PriorityBadge } from '@/components/priority-badge';
import { todayIso, type Contact } from '@/lib/contacts/schema';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a bare `YYYY-MM-DD`.
 *
 * Parsed as UTC and formatted in UTC on purpose: `new Date('2026-09-02')` is
 * midnight UTC, which is the previous day in the Americas, so formatting it
 * locally would display the wrong date.
 */
function formatDay(day: string | null): string | null {
  if (!day) return null;
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const DASH = <span className="text-muted-foreground/50">—</span>;

export function ContactList({
  contacts,
  onEdit,
  onDelete,
  today = todayIso(),
}: {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => Promise<void>;
  today?: string;
}) {
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await onDelete(pendingDelete);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Desktop: a real table. */}
      <div className="border-border/70 bg-card hidden overflow-hidden rounded-2xl border shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-muted-foreground h-11 text-xs font-medium tracking-wide uppercase">
                Person
              </TableHead>
              <TableHead className="text-muted-foreground h-11 text-xs font-medium tracking-wide uppercase">
                Company
              </TableHead>
              <TableHead className="text-muted-foreground h-11 text-xs font-medium tracking-wide uppercase">
                Where you met
              </TableHead>
              <TableHead className="text-muted-foreground h-11 text-xs font-medium tracking-wide uppercase">
                Priority
              </TableHead>
              <TableHead className="text-muted-foreground h-11 text-xs font-medium tracking-wide uppercase">
                Follow-up
              </TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact, i) => (
              <TableRow
                key={contact.id}
                className="group animate-rise border-border/60 transition-colors"
                style={{ '--i': i } as React.CSSProperties}
              >
                <TableCell className="max-w-xs py-3.5 align-top">
                  <div className="flex gap-3">
                    <ContactAvatar name={contact.name} />
                    <div className="min-w-0">
                      <div className="font-medium">{contact.name}</div>
                      {contact.role && (
                        <div className="text-muted-foreground truncate text-sm">
                          {contact.role}
                        </div>
                      )}
                      {contact.notes && (
                        <p className="text-muted-foreground/80 mt-1 line-clamp-2 text-xs leading-relaxed">
                          {contact.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3.5 align-top text-sm">
                  {contact.company ?? DASH}
                </TableCell>
                <TableCell className="py-3.5 align-top text-sm">
                  {contact.met_at ?? (contact.met_on ? '' : DASH)}
                  {contact.met_on && (
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {formatDay(contact.met_on)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="py-3.5 align-top">
                  <PriorityBadge priority={contact.priority} />
                </TableCell>
                <TableCell className="py-3.5 align-top whitespace-nowrap">
                  {contact.follow_up_on ? (
                    <FollowUpBadge date={contact.follow_up_on} today={today} />
                  ) : (
                    DASH
                  )}
                </TableCell>
                <TableCell className="py-3.5 align-top text-right">
                  {/* Revealed on hover, but always reachable by keyboard. */}
                  <div className="flex justify-end gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Edit ${contact.name}`}
                      onClick={() => onEdit(contact)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:text-destructive hover:bg-destructive/10 size-8"
                      aria-label={`Delete ${contact.name}`}
                      onClick={() => setPendingDelete(contact)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards — a six-column table is unusable at 375px. */}
      <ul className="space-y-3 md:hidden">
        {contacts.map((contact, i) => (
          <li
            key={contact.id}
            className="border-border/70 bg-card animate-rise hover-lift rounded-xl border p-4 shadow-sm"
            style={{ '--i': i } as React.CSSProperties}
          >
            <div className="flex items-start gap-3">
              <ContactAvatar name={contact.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="leading-tight font-medium">{contact.name}</p>
                  <PriorityBadge priority={contact.priority} />
                </div>
                {(contact.role || contact.company) && (
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {[contact.role, contact.company].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>

            {(contact.met_at || contact.met_on) && (
              <div className="text-muted-foreground mt-3 space-y-1 text-sm">
                {contact.met_at && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    {contact.met_at}
                  </p>
                )}
                {contact.met_on && (
                  <p className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                    Met {formatDay(contact.met_on)}
                  </p>
                )}
              </div>
            )}

            {contact.follow_up_on && (
              <div className="mt-3">
                <FollowUpBadge date={contact.follow_up_on} today={today} />
              </div>
            )}
            {contact.notes && (
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                {contact.notes}
              </p>
            )}

            <div className="border-border/60 mt-3.5 flex items-center justify-between border-t pt-3">
              <span className="text-muted-foreground text-xs">
                Added {formatDate(contact.created_at)}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  aria-label={`Edit ${contact.name}`}
                  onClick={() => onEdit(contact)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:text-destructive hover:bg-destructive/10 size-8"
                  aria-label={`Delete ${contact.name}`}
                  onClick={() => setPendingDelete(contact)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes this contact from your list. It cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
