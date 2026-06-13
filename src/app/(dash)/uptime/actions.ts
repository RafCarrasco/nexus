'use server';
import { prisma } from '@/db/client';
import { requireWriter } from '@/auth/guards';
import { writeAudit } from '@/lib/audit';
import { isSafePublicHttpUrl } from '@/lib/http';
import { revalidatePath } from 'next/cache';

export async function createUptimeCheck(formData: FormData) {
  const user = await requireWriter();
  const name = String(formData.get('name') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  const intervalSec = Math.max(30, Number(formData.get('intervalSec') ?? 300) || 300);
  const failThreshold = Math.max(1, Number(formData.get('failThreshold') ?? 3) || 3);
  const method = String(formData.get('method') ?? 'GET') === 'HEAD' ? 'HEAD' : 'GET';
  if (!name || !url) return;
  if (!isSafePublicHttpUrl(url)) throw new Error('URL inválida ou aponta para rede interna');

  const row = await prisma.uptimeCheck.create({
    data: { name, url, method, intervalSec, failThreshold },
  });
  await writeAudit({ userId: user?.id, action: 'uptime.create', target: row.id, payload: { name, url } });
  revalidatePath('/uptime');
}

export async function deleteUptimeCheck(formData: FormData) {
  const user = await requireWriter();
  const id = String(formData.get('id') ?? '');
  await prisma.uptimeCheck.delete({ where: { id } });
  await writeAudit({ userId: user?.id, action: 'uptime.delete', target: id });
  revalidatePath('/uptime');
}
