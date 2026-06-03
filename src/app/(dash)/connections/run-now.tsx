'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/components/button';
import { useToast } from '@/ui/components/toast';

export function RunNow() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      title="Rodar coletor manualmente agora"
      onClick={() =>
        start(async () => {
          const res = await fetch('/api/collector/run', { method: 'POST' });
          if (res.ok) {
            toast('Coletor disparado com sucesso', 'success');
          } else {
            toast('Erro ao disparar coletor', 'error');
          }
          router.refresh();
        })
      }
    >
      {pending ? 'Rodando…' : 'Rodar coletor agora'}
    </Button>
  );
}
