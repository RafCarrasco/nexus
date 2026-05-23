'use server';
import { prisma } from '@/db/client';
import { auth } from '@/auth/config';
import { revalidatePath } from 'next/cache';

export async function setResourceClient(formData: FormData) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== 'admin') throw new Error('forbidden');
  const id = String(formData.get('resourceId'));
  const clientId = String(formData.get('clientId') ?? '');
  const pctRaw = String(formData.get('allocationPct') ?? '');
  const pct = pctRaw === '' ? null : Math.max(0, Math.min(100, Number(pctRaw)));
  await prisma.resource.update({
    where: { id },
    data: { clientId: clientId || null, allocationPct: pct },
  });
  revalidatePath('/settings/allocations');
}

export async function setTenantClient(formData: FormData) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== 'admin') throw new Error('forbidden');
  const id = String(formData.get('tenantId'));
  const clientId = String(formData.get('clientId') ?? '');
  await prisma.tenant.update({
    where: { id },
    data: { clientId: clientId || null },
  });
  revalidatePath('/settings/allocations');
}
