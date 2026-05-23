'use server';
import { prisma } from '@/db/client';
import { auth } from '@/auth/config';
import { revalidatePath } from 'next/cache';

export async function createClient(formData: FormData) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== 'admin') throw new Error('forbidden');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  await prisma.client.create({ data: { name } });
  revalidatePath('/settings/clients');
}

export async function deleteClient(formData: FormData) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== 'admin') throw new Error('forbidden');
  const id = String(formData.get('id') ?? '');
  await prisma.client.delete({ where: { id } });
  revalidatePath('/settings/clients');
}
