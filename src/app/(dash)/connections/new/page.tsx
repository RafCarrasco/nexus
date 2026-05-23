'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';
import { PageHeader } from '@/ui/components/page-header';

export default function NewConnectionPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState('firebase');
  const [config, setConfig] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const parsedConfig = JSON.parse(config);
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, type, config: parsedConfig }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      router.push('/connections');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New connection" />

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm max-w-2xl space-y-5">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Production Firebase"
            className="border-zinc-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 focus:ring-offset-0"
          />
        </div>

        <div className="space-y-2">
          <Label>Type</Label>
          <select
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500 bg-white"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="firebase">firebase</option>
            <option value="supabase">supabase</option>
            <option value="docker">docker</option>
            <option value="fake">fake (dev only)</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label>Config (JSON)</Label>
          <textarea
            className="w-full min-h-[240px] rounded-md border border-zinc-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500"
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            placeholder={'{\n  "serviceAccount": { ... },\n  "billingAccountId": "..."\n}'}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 whitespace-pre-wrap">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button onClick={submit} disabled={busy || !name}>
            {busy ? 'Saving…' : 'Save connection'}
          </Button>
          <Button variant="outline" onClick={() => router.back()} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
