'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, UserPen, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ContactError } from '@/lib/contacts/api';
import {
  DATE_RANGE,
  LIMITS,
  PRIORITIES,
  PRIORITY_LABELS,
  parseContactInput,
  type Contact,
  type FieldErrors,
  type Priority,
} from '@/lib/contacts/schema';

type Draft = {
  name: string;
  company: string;
  role: string;
  met_at: string;
  met_on: string;
  follow_up_on: string;
  notes: string;
  priority: string;
};

const BLANK: Draft = {
  name: '',
  company: '',
  role: '',
  met_at: '',
  met_on: '',
  follow_up_on: '',
  notes: '',
  priority: 'medium',
};

function toDraft(contact: Contact | null): Draft {
  if (!contact) return BLANK;
  return {
    name: contact.name,
    company: contact.company ?? '',
    role: contact.role ?? '',
    met_at: contact.met_at ?? '',
    met_on: contact.met_on ?? '',
    follow_up_on: contact.follow_up_on ?? '',
    notes: contact.notes ?? '',
    priority: contact.priority,
  };
}

export function ContactFormDialog({
  open,
  contact,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  /** null = creating, a contact = editing. */
  contact: Contact | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: Draft) => Promise<void>;
}) {
  const editing = contact !== null;

  // The parent remounts this component (via `key`) each time the dialog opens,
  // so initial state is derived once here rather than resynced in an effect.
  const [draft, setDraft] = useState<Draft>(() => toDraft(contact));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, _form: undefined }));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Validate with the same schema the database mirrors, so the user gets an
    // inline message instead of a round trip and a constraint error.
    const parsed = parseContactInput(draft);
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }

    setSaving(true);
    try {
      await onSubmit(draft);
      onOpenChange(false);
    } catch (caught) {
      if (caught instanceof ContactError) {
        setErrors({ ...caught.fieldErrors, _form: caught.message });
      } else {
        setErrors({
          _form:
            caught instanceof Error
              ? caught.message
              : 'Something went wrong. Please try again.',
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="bg-brand-gradient flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
              {editing ? (
                <UserPen className="size-5 text-white" aria-hidden />
              ) : (
                <UserPlus className="size-5 text-white" aria-hidden />
              )}
            </span>
            <div className="space-y-1">
              <DialogTitle className="text-base">
                {editing ? 'Edit contact' : 'Add contact'}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {editing
                  ? 'Update what you know about this person.'
                  : 'Only a name is required — you can fill in the rest later.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact-name"
              value={draft.name}
              maxLength={LIMITS.name + 20}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'contact-name-error' : undefined}
              onChange={(e) => set('name', e.target.value)}
            />
            {errors.name && (
              <p id="contact-name-error" role="alert" className="text-destructive text-sm">
                {errors.name}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-company">Company</Label>
              <Input
                id="contact-company"
                value={draft.company}
                aria-invalid={Boolean(errors.company)}
                onChange={(e) => set('company', e.target.value)}
              />
              {errors.company && (
                <p role="alert" className="text-destructive text-sm">
                  {errors.company}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-role">Role</Label>
              <Input
                id="contact-role"
                value={draft.role}
                aria-invalid={Boolean(errors.role)}
                onChange={(e) => set('role', e.target.value)}
              />
              {errors.role && (
                <p role="alert" className="text-destructive text-sm">
                  {errors.role}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-met-at">Where you met</Label>
            <Input
              id="contact-met-at"
              placeholder="Haas AI mixer, Berkeley Forum, …"
              value={draft.met_at}
              aria-invalid={Boolean(errors.met_at)}
              onChange={(e) => set('met_at', e.target.value)}
            />
            {errors.met_at && (
              <p role="alert" className="text-destructive text-sm">
                {errors.met_at}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-met-on">Date met</Label>
              <Input
                id="contact-met-on"
                type="date"
                max={DATE_RANGE.max}
                min={DATE_RANGE.min}
                value={draft.met_on}
                aria-invalid={Boolean(errors.met_on)}
                onChange={(e) => set('met_on', e.target.value)}
              />
              {errors.met_on && (
                <p role="alert" className="text-destructive text-sm">
                  {errors.met_on}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-follow-up-on">Follow up on</Label>
              <Input
                id="contact-follow-up-on"
                type="date"
                max={DATE_RANGE.max}
                min={DATE_RANGE.min}
                value={draft.follow_up_on}
                aria-invalid={Boolean(errors.follow_up_on)}
                aria-describedby="follow-up-hint"
                onChange={(e) => set('follow_up_on', e.target.value)}
              />
              {errors.follow_up_on ? (
                <p role="alert" className="text-destructive text-sm">
                  {errors.follow_up_on}
                </p>
              ) : (
                <p id="follow-up-hint" className="text-muted-foreground text-xs">
                  You&apos;ll be reminded on the day.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-priority">Priority</Label>
            <Select
              value={draft.priority}
              onValueChange={(v) => set('priority', v ?? 'medium')}
            >
              <SelectTrigger id="contact-priority" className="w-full">
                <SelectValue placeholder="Select a priority">
                  {(v) =>
                    v == null
                      ? 'Select a priority'
                      : (PRIORITY_LABELS[v as Priority] ?? String(v))
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span
                        className={`size-1.5 rounded-full ${
                          p === 'high'
                            ? 'bg-priority-high'
                            : p === 'medium'
                              ? 'bg-priority-medium'
                              : 'bg-priority-low'
                        }`}
                      />
                      {PRIORITY_LABELS[p]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.priority && (
              <p role="alert" className="text-destructive text-sm">
                {errors.priority}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea
              id="contact-notes"
              rows={3}
              placeholder="What did you talk about? What should you follow up on?"
              value={draft.notes}
              aria-invalid={Boolean(errors.notes)}
              onChange={(e) => set('notes', e.target.value)}
            />
            {errors.notes && (
              <p role="alert" className="text-destructive text-sm">
                {errors.notes}
              </p>
            )}
          </div>

          {errors._form && (
            <p
              role="alert"
              className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
            >
              {errors._form}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="min-w-32">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
