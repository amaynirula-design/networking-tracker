'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
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
import { PriorityBadge } from '@/components/priority-badge';
import type { Contact } from '@/lib/contacts/schema';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ContactList({
  contacts,
  onEdit,
  onDelete,
}: {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => Promise<void>;
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
      <div className="bg-card hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Where you met</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="max-w-xs align-top">
                  <div className="font-medium">{contact.name}</div>
                  {contact.role && (
                    <div className="text-muted-foreground text-sm">
                      {contact.role}
                    </div>
                  )}
                  {contact.notes && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                      {contact.notes}
                    </p>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {contact.company ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="align-top">
                  {contact.met_at ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="align-top">
                  <PriorityBadge priority={contact.priority} />
                </TableCell>
                <TableCell className="text-muted-foreground align-top text-sm whitespace-nowrap">
                  {formatDate(contact.created_at)}
                </TableCell>
                <TableCell className="align-top text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${contact.name}`}
                      onClick={() => onEdit(contact)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${contact.name}`}
                      onClick={() => setPendingDelete(contact)}
                    >
                      <Trash2 className="text-destructive size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards — a 6-column table is unusable at 375px. */}
      <ul className="space-y-3 md:hidden">
        {contacts.map((contact) => (
          <li key={contact.id} className="bg-card rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{contact.name}</p>
                {(contact.role || contact.company) && (
                  <p className="text-muted-foreground text-sm">
                    {[contact.role, contact.company].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <PriorityBadge priority={contact.priority} />
            </div>

            {contact.met_at && (
              <p className="text-muted-foreground mt-2 text-sm">
                <span className="font-medium">Met:</span> {contact.met_at}
              </p>
            )}
            {contact.notes && (
              <p className="mt-2 text-sm whitespace-pre-wrap">{contact.notes}</p>
            )}

            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="text-muted-foreground text-xs">
                Added {formatDate(contact.created_at)}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${contact.name}`}
                  onClick={() => onEdit(contact)}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${contact.name}`}
                  onClick={() => setPendingDelete(contact)}
                >
                  <Trash2 className="text-destructive size-4" />
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
            <AlertDialogTitle>
              Delete {pendingDelete?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes this contact from your list. It cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
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
