'use server';
import { prisma } from '@/db/client';
import { requireWriter } from '@/auth/guards';
import { writeAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

const METRICS = ['cost_30d', 'open_incidents'];

export async function createAlertRule(formData: FormData) {
  const user = await requireWriter();
  const name = String(formData.get('name') ?? '').trim();
  const metric = String(formData.get('metric') ?? 'cost_30d');
  const operator = String(formData.get('operator') ?? 'gt') === 'lt' ? 'lt' : 'gt';
  const threshold = Number(formData.get('threshold') ?? 0);
  const workspaceId = String(formData.get('workspaceId') ?? '') || null;
  if (!name || !Number.isFinite(threshold) || !METRICS.includes(metric)) return;

  const row = await prisma.alertRule.create({ data: { name, metric, operator, threshold, workspaceId } });
  await writeAudit({ userId: user?.id, action: 'alert.create', target: row.id, payload: { name, metric, threshold } });
  revalidatePath('/alerts');
}

export async function deleteAlertRule(formData: FormData) {
  const user = await requireWriter();
  const id = String(formData.get('id') ?? '');
  await prisma.alertRule.delete({ where: { id } });
  await writeAudit({ userId: user?.id, action: 'alert.delete', target: id });
  revalidatePath('/alerts');
}
