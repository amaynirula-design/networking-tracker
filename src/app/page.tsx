'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoading } from '@/components/states';
import { isNeonConfigured, neon } from '@/lib/neon';
import { SetupNotice } from '@/components/setup-notice';

/** Entry point: send people to their contacts, or to sign in. */
export default function HomePage() {
  const router = useRouter();
  const session = neon.auth.useSession();

  useEffect(() => {
    if (!isNeonConfigured || session.isPending) return;
    router.replace(session.data ? '/contacts' : '/sign-in');
  }, [session.isPending, session.data, router]);

  if (!isNeonConfigured) return <SetupNotice />;
  return <PageLoading />;
}
