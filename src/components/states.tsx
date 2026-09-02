'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Loader2, SearchX, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Full-page spinner used while the session is still resolving. */
export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4"
    >
      <span className="relative flex size-12 items-center justify-center">
        <span className="bg-brand/10 absolute inset-0 animate-ping rounded-full" />
        <span className="bg-card ring-border relative flex size-12 items-center justify-center rounded-full shadow-sm ring-1">
          <Loader2 className="text-brand size-5 animate-spin" />
        </span>
      </span>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

/** Skeleton rows shown while contacts are being fetched for the first time. */
export function ContactsLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">Loading your contacts…</span>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-card animate-rise border-border/70 flex items-center gap-4 rounded-xl border p-4 shadow-sm"
          style={{ '--i': i } as React.CSSProperties}
        >
          <div className="bg-muted animate-sheen size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <div className="bg-muted animate-sheen h-3.5 w-40 rounded-full" />
            <div className="bg-muted animate-sheen h-3 w-64 rounded-full opacity-70" />
          </div>
          <div className="bg-muted animate-sheen h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  filtered = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  filtered?: boolean;
}) {
  const Icon = filtered ? SearchX : UserPlus;
  return (
    <div className="border-border/70 bg-card/60 animate-fade-in flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
      <span className="bg-brand-gradient mb-1 flex size-12 items-center justify-center rounded-2xl shadow-sm">
        <Icon className="size-6 text-white" aria-hidden />
      </span>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 animate-fade-in flex flex-col items-center gap-3 rounded-2xl border px-6 py-14 text-center"
    >
      <span className="bg-destructive/10 flex size-12 items-center justify-center rounded-2xl">
        <AlertCircle className="text-destructive size-6" aria-hidden />
      </span>
      <h2 className="text-base font-semibold tracking-tight">
        Something went wrong
      </h2>
      <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
