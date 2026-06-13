'use server';
import { prisma } from '@/db/client';
import { requireWriter } from '@/auth/guards';
import { writeAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export async function updateWorkspace(formData: FormData) {
  const user = await requireWriter();

  const id = String(formData.get('id') ?? '');
  const slug = String(formData.get('slug') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!id || !name) return;

  await prisma.workspace.update({
    where: { id },
    data: { name, description: description || null },
  });
  await writeAudit({ userId: user?.id, action: 'workspace.update', target: id, payload: { name } });
  revalidatePath(`/workspaces/${slug}`);
  revalidatePath('/workspaces');
}
