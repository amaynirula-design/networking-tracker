'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { neon, isNeonConfigured } from '@/lib/neon';
import { SetupNotice } from '@/components/setup-notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'sign-in' | 'sign-up';

const COPY = {
  'sign-in': {
    title: 'Welcome back',
    subtitle: 'Sign in to see the people you are keeping up with.',
    submit: 'Sign in',
    switchPrompt: "Don't have an account?",
    switchCta: 'Create one',
    switchHref: '/sign-up' as const,
  },
  'sign-up': {
    title: 'Create your account',
    subtitle: 'Start tracking the people you meet at Berkeley.',
    submit: 'Create account',
    switchPrompt: 'Already have an account?',
    switchCta: 'Sign in',
    switchHref: '/sign-in' as const,
  },
};

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
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{copy.subtitle}</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {mode === 'sign-up' && (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={
              mode === 'sign-in' ? 'current-password' : 'new-password'
            }
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
          {mode === 'sign-up' && (
            <p className="text-muted-foreground text-xs">
              At least 8 characters.
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? 'Please wait…' : copy.submit}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        {copy.switchPrompt}{' '}
        <Link
          href={copy.switchHref}
          className="text-foreground font-medium underline underline-offset-4"
        >
          {copy.switchCta}
        </Link>
      </p>
    </main>
  );
}
