'use server';
import { prisma } from '@/db/client';
import { requireAdmin } from '@/auth/guards';
import { writeAudit } from '@/lib/audit';
import { encrypt } from '@/crypto/vault';
import { revalidatePath } from 'next/cache';
import { AI_CONFIG_ID, isAiProvider } from '@/lib/ai';

export async function saveAiConfig(formData: FormData) {
  const user = await requireAdmin();
  const providerRaw = String(formData.get('provider') ?? 'anthropic');
  const provider = isAiProvider(providerRaw) ? providerRaw : 'anthropic';
  const model = String(formData.get('model') ?? '').trim() || null;
  const apiKey = String(formData.get('apiKey') ?? '').trim();

  const existing = await prisma.aiConfig.findUnique({ where: { id: AI_CONFIG_ID } });
  if (!apiKey && !existing) throw new Error('Informe a chave de API.');

  // Blank key on an existing config = keep the current key (lets admins change
  // provider/model without re-pasting the secret).
  const config = apiKey ? (encrypt({ apiKey }) as unknown as Uint8Array<ArrayBuffer>) : undefined;

  await prisma.aiConfig.upsert({
    where: { id: AI_CONFIG_ID },
    create: { id: AI_CONFIG_ID, provider, model, config: config! },
    update: { provider, model, ...(config ? { config } : {}) },
  });
  // Audit records provider + model only — never the key.
  await writeAudit({ userId: user?.id, action: 'ai.config', target: provider, payload: { provider, model } });
  revalidatePath('/settings/ai');
}
