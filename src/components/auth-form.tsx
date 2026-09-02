'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Lock, NotebookPen, Users } from 'lucide-react';
import { neon, isNeonConfigured } from '@/lib/neon';
import { BrandMark, BrandWordmark } from '@/components/brand';
import { SetupNotice } from '@/components/setup-notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'sign-in' | 'sign-up';

const COPY = {
  'sign-in': {
    title: 'Welcome back',
    subtitle: 'Pick up where you left off with the people you’ve met.',
    submit: 'Sign in',
    switchPrompt: 'New here?',
    switchCta: 'Create an account',
    switchHref: '/sign-up' as const,
  },
  'sign-up': {
    title: 'Start your list',
    subtitle: 'A private space for the people worth staying in touch with.',
    submit: 'Create account',
    switchPrompt: 'Already have an account?',
    switchCta: 'Sign in',
    switchHref: '/sign-in' as const,
  },
};

const HIGHLIGHTS = [
  {
    icon: Users,
    title: 'Everyone in one place',
    body: 'Name, company, role, where you met, and what you talked about.',
  },
  {
    icon: NotebookPen,
    title: 'Follow up on the right people',
    body: 'Mark priority, then search and sort to find who is next.',
  },
  {
    icon: Lock,
    title: 'Private by construction',
    body: 'Ownership is enforced by the database, not just the interface.',
  },
];

/** Better Auth reports failures in a result object rather than by throwing. */
function messageFor(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim() !== '') return message;
  }
  return fallback;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const copy = COPY[mode];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isNeonConfigured) return <SetupNotice />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === 'sign-up' && name.trim() === '') {
      setError('Please enter your name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const result =
        mode === 'sign-in'
          ? await neon.auth.signIn.email({ email: email.trim(), password })
          : await neon.auth.signUp.email({
              email: email.trim(),
              password,
              name: name.trim(),
            });

      if (result?.error) {
        setError(
          messageFor(
            result.error,
            mode === 'sign-in'
              ? 'That email and password did not match.'
              : 'Could not create that account.',
          ),
        );
        return;
      }

      router.replace('/contacts');
      router.refresh();
    } catch (caught) {
      setError(messageFor(caught, 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      {/* Brand panel — the pitch. Hidden on small screens, where it would just
          push the form below the fold. */}
      <aside className="bg-brand-gradient relative hidden overflow-hidden lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-[var(--brand-gold)]/12 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5 text-white">
          <BrandMark className="bg-white/15 ring-white/25" />
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight">
              Networking Tracker
            </span>
            <span className="block text-[11px] tracking-wide text-white/70 uppercase">
              Berkeley
            </span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-white">
            The conversation was good. Don’t let it end there.
          </h2>
          <p className="mt-3 leading-relaxed text-white/70">
            You meet a lot of people at Berkeley. This keeps track of who they
            are and what you said you’d do next.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/20">
                  <Icon className="size-4 text-white" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">
                    {title}
                  </span>
                  <span className="block text-sm leading-relaxed text-white/65">
                    {body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/65">
          Built for the Haas Agentic AI course.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-8 lg:px-14">
        <div className="animate-rise mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <BrandWordmark />
          </div>

          <div className="mt-8 lg:mt-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {copy.title}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              {copy.subtitle}
            </p>
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-7 space-y-4">
            {mode === 'sign-up' && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@berkeley.edu"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === 'sign-in' ? 'current-password' : 'new-password'
                }
                placeholder={mode === 'sign-up' ? 'At least 8 characters' : '••••••••'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive/5 text-destructive animate-fade-in rounded-lg border px-3 py-2.5 text-sm"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="group w-full"
              size="lg"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Please wait…
                </>
              ) : (
                <>
                  {copy.submit}
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            {copy.switchPrompt}{' '}
            <Link
              href={copy.switchHref}
              className="text-foreground decoration-brand/40 hover:decoration-brand font-medium underline underline-offset-4 transition-colors"
            >
              {copy.switchCta}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
