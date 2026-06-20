'use server';
import { prisma } from '@/db/client';
import { requireWriter } from '@/auth/guards';
import { writeAudit } from '@/lib/audit';
import { isSafePublicHttpUrl } from '@/lib/http';
import { revalidatePath } from 'next/cache';

export async function createAiProbe(formData: FormData) {
  const user = await requireWriter();
  const name = String(formData.get('name') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  const method = String(formData.get('method') ?? 'POST') === 'GET' ? 'GET' : 'POST';
  const bodyTemplate = String(formData.get('bodyTemplate') ?? '').trim();
  const prompt = String(formData.get('prompt') ?? '').trim();
  const responsePath = String(formData.get('responsePath') ?? '').trim() || null;
  const validationMode = String(formData.get('validationMode') ?? 'rule') === 'llm_judge' ? 'llm_judge' : 'rule';
  const validationRule = String(formData.get('validationRule') ?? '').trim() || null;
  const intervalSec = Math.max(30, Number(formData.get('intervalSec') ?? 300) || 300);
  const failThreshold = Math.max(1, Number(formData.get('failThreshold') ?? 2) || 2);
  if (!name || !url || !bodyTemplate || !prompt) return;
  if (!isSafePublicHttpUrl(url)) throw new Error('URL inválida ou aponta para rede interna');

  const row = await prisma.aiProbe.create({
    data: {
      name,
      url,
      method,
      bodyTemplate,
      prompt,
      responsePath,
      validationMode,
      validationRule,
      intervalSec,
      failThreshold,
    },
  });
  await writeAudit({ userId: user?.id, action: 'ai_probe.create', target: row.id, payload: { name, url, validationMode } });
  revalidatePath('/probes');
}

export async function deleteAiProbe(formData: FormData) {
  const user = await requireWriter();
  const id = String(formData.get('id') ?? '');
  await prisma.aiProbe.delete({ where: { id } });
  await writeAudit({ userId: user?.id, action: 'ai_probe.delete', target: id });
  revalidatePath('/probes');
}
