'use server';
import { prisma } from '@/db/client';
import { auth } from '@/auth/config';
import { writeAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export async function updateWorkspace(formData: FormData) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== 'admin' && user?.role !== 'member') throw new Error('forbidden');

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
