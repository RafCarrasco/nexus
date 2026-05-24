'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/components/dialog';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';
import { AlertTriangle } from 'lucide-react';

type Props = {
  /** Trigger element (button, menu item, icon). */
  trigger: ReactNode;
  /** Title shown at top of dialog. */
  title: string;
  /** The exact string user must type to enable confirmation. */
  confirmName: string;
  /** Label for the input. e.g. "Digite o nome do aplicativo para confirmar" */
  inputLabel: string;
  /** Plain-text description of what gets deleted (newline-separated). */
  description: string;
  /** Endpoint to call with DELETE. */
  endpoint: string;
  /** Optional path to navigate to after success. If omitted, just refresh. */
  onSuccessRedirect?: string;
  /** Optional callback for additional client work after success. */
  onSuccess?: () => void;
};

export function DeleteConfirmDialog({
  trigger,
  title,
  confirmName,
  inputLabel,
  description,
  endpoint,
  onSuccessRedirect,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const matches = typed.trim() === confirmName;

  function onConfirm() {
    if (!matches) return;
    setError(null);
    start(async () => {
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        setError(await res.text());
        return;
      }
      setOpen(false);
      setTyped('');
      onSuccess?.();
      if (onSuccessRedirect) router.push(onSuccessRedirect as never);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setTyped('');
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p className="text-zinc-700 font-medium">Esta ação não pode ser desfeita.</p>
              <p className="text-zinc-600 whitespace-pre-line">{description}</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-name" className="text-xs text-zinc-600">
            {inputLabel}
          </Label>
          <Input
            id="confirm-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmName}
            autoComplete="off"
            className="font-mono text-sm"
          />
          <div className="text-xs text-zinc-500">
            Digite exatamente:{' '}
            <span className="font-mono font-semibold text-zinc-800">{confirmName}</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2 whitespace-pre-wrap">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!matches || pending}
            className="bg-red-600 hover:bg-red-700 text-white disabled:bg-red-200 disabled:cursor-not-allowed"
          >
            {pending ? 'Excluindo…' : 'Excluir definitivamente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
