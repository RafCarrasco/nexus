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
    <>
      <PageHeader title="New connection" />
      <div className="p-6 max-w-2xl space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production Firebase" />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <select
            className="w-full rounded-md border px-3 py-2"
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
            className="w-full min-h-[240px] rounded-md border px-3 py-2 font-mono text-sm"
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            placeholder={'{\n  "serviceAccount": { ... },\n  "billingAccountId": "..."\n}'}
          />
        </div>
        {error && <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>}
        <Button onClick={submit} disabled={busy || !name}>Save</Button>
      </div>
    </>
  );
}
