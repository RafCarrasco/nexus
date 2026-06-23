'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/components/button';

/**
 * Resolve/Reopen toggle for the incident detail page. Mirrors the row-level
 * ResolveButton (fetch PATCH + router.refresh), but flips action by current state.
 */
export function ResolveToggle({ id, resolved }: { id: string; resolved: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={resolved ? 'outline' : 'default'}
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await fetch(`/api/incidents/${id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ resolved: !resolved }),
          });
          router.refresh();
        })
      }
    >
      {pending ? (resolved ? 'Reabrindo…' : 'Resolvendo…') : resolved ? 'Reabrir' : 'Resolver'}
    </Button>
  );
}
