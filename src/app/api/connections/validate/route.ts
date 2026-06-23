import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertApiRole } from '@/auth/guards';
import { getProvider, listProviderTypes } from '@/providers/registry';

/**
 * Dry-run credential check: runs the provider's validate (or listResources) against the
 * supplied config WITHOUT persisting anything. Lets the "Testar conexão" button catch a
 * typo'd token or unreachable project before a broken connection is saved and silently
 * stalls resource discovery. Admin-gated like connection creation — it triggers outbound
 * calls with caller-provided credentials.
 */
const schema = z.object({
  type: z.string().min(1),
  config: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: Request) {
  const gate = await assertApiRole(req, ['admin']);
  if (gate.response) return gate.response;

  const json = await req.json().catch(() => null);
  const parse = schema.safeParse(json);
  if (!parse.success) return NextResponse.json({ ok: false, error: 'payload inválido' }, { status: 400 });

  const { type, config } = parse.data;
  if (!listProviderTypes().includes(type)) {
    return NextResponse.json({ ok: false, error: `tipo de provedor desconhecido: ${type}` });
  }

  const provider = getProvider(type);
  const view = { id: 'test-' + Date.now(), type, config };
  try {
    if (provider.validate) await provider.validate(view);
    else await provider.listResources(view);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }
}
