'use server';
import { prisma } from '@/db/client';
import { requireAdmin } from '@/auth/guards';
import { revalidatePath } from 'next/cache';

export async function createClient(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  await prisma.client.create({ data: { name } });
  revalidatePath('/settings/clients');
}

export async function deleteClient(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  await prisma.client.delete({ where: { id } });
  revalidatePath('/settings/clients');
}
