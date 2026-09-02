import { AlertCircle } from 'lucide-react';

/**
 * Shown when the app was built without Neon URLs — e.g. a grader who cloned the
 * repo and ran `npm run dev` before creating `.env.local`. Better to explain
 * than to fail with a network error.
 */
export function SetupNotice() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
      <div className="bg-card space-y-4 rounded-lg border p-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="text-destructive size-5" aria-hidden />
          <h1 className="text-lg font-semibold">Configuration needed</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          This app needs your Neon project&apos;s public endpoints before it can
          sign anyone in.
        </p>
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
          <li>
            Copy <code className="text-foreground">.env.example</code> to{' '}
            <code className="text-foreground">.env.local</code>.
          </li>
          <li>
            Fill in <code className="text-foreground">NEXT_PUBLIC_NEON_AUTH_URL</code>{' '}
            and{' '}
            <code className="text-foreground">
              NEXT_PUBLIC_NEON_DATA_API_URL
            </code>
            .
          </li>
          <li>Restart the dev server.</li>
        </ol>
        <p className="text-muted-foreground text-xs">
          See the README for the full Neon setup walkthrough.
        </p>
      </div>
    </main>
  );
}
