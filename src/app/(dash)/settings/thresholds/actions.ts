'use server';
import { prisma } from '@/db/client';
import { requireAdmin } from '@/auth/guards';
import { writeAudit } from '@/lib/audit';
import { isMetricOperator } from '@/lib/metric-threshold';
import { thresholdIncidentType } from '@/lib/metric-threshold';
import { revalidatePath } from 'next/cache';

export async function createThreshold(formData: FormData) {
  const user = await requireAdmin();
  const resourceId = String(formData.get('resourceId') ?? '').trim();
  const metricName = String(formData.get('metricName') ?? '').trim();
  const operator = String(formData.get('operator') ?? '').trim();
  const thresholdRaw = String(formData.get('threshold') ?? '').trim();
  const severity = String(formData.get('severity') ?? 'warn').trim();
  const lookbackSec = Number(formData.get('lookbackSec') ?? 3600) || 3600;

  if (!resourceId || !metricName) throw new Error('recurso e métrica são obrigatórios');
  if (!isMetricOperator(operator)) throw new Error('operador inválido');
  const threshold = Number(thresholdRaw);
  if (!Number.isFinite(threshold)) throw new Error('limite deve ser numérico');
  if (severity !== 'warn' && severity !== 'crit') throw new Error('severidade inválida');

  const res = await prisma.resource.findUnique({ where: { id: resourceId }, select: { id: true } });
  if (!res) throw new Error('recurso não encontrado');

  const row = await prisma.metricThreshold.create({
    data: { resourceId, metricName, operator, threshold, severity, lookbackSec },
  });
  await writeAudit({
    userId: user?.id,
    action: 'metric_threshold.create',
    target: row.id,
    payload: { resourceId, metricName, operator, threshold, severity },
  });
  revalidatePath('/settings/thresholds');
}

export async function deleteThreshold(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const row = await prisma.metricThreshold.findUnique({
    where: { id },
    select: { metricName: true, resourceId: true },
  });
  await prisma.metricThreshold.delete({ where: { id } });
  // Resolve any incident this rule had open so it doesn't dangle forever.
  if (row) {
    await prisma.incident.updateMany({
      where: { resourceId: row.resourceId, type: thresholdIncidentType(row.metricName), resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  }
  await writeAudit({ userId: user?.id, action: 'metric_threshold.delete', target: id, payload: row ?? undefined });
  revalidatePath('/settings/thresholds');
}

export async function toggleThreshold(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const row = await prisma.metricThreshold.findUnique({ where: { id }, select: { enabled: true } });
  if (!row) return;
  await prisma.metricThreshold.update({ where: { id }, data: { enabled: !row.enabled } });
  await writeAudit({
    userId: user?.id,
    action: 'metric_threshold.toggle',
    target: id,
    payload: { enabled: !row.enabled },
  });
  revalidatePath('/settings/thresholds');
}
