'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/components/button';

export function RunNow() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await fetch('/api/collector/run', { method: 'POST' });
          router.refresh();
        })
      }
    >
      {pending ? 'Rodando…' : 'Rodar coletor agora'}
    </Button>
  );
}
