'use server';
import { prisma } from '@/db/client';
/**
 * Saved filters are PERSONAL (not admin-only): any authenticated user
 * (admin or member) may manage their own. requireUser() always derives the
 * owning userId from the session — never from the form — so a request can't
 * create or delete another user's filters (IDOR guard).
 */
import { requireUser } from '@/auth/guards';
import { writeAudit } from '@/lib/audit';
import { isValidPage, sanitizeQuery } from '@/lib/saved-filters';
import { revalidatePath } from 'next/cache';

export async function saveFilter(formData: FormData) {
  const user = await requireUser();
  const page = String(formData.get('page') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const rawQuery = String(formData.get('query') ?? '{}');
  if (!isValidPage(page)) return;
  if (!name || name.length > 60) return;

  let parsed: Record<string, unknown> = {};
  try {
    const j = JSON.parse(rawQuery);
    if (j && typeof j === 'object' && !Array.isArray(j)) parsed = j as Record<string, unknown>;
  } catch {
    return;
  }
  const query = sanitizeQuery(page, parsed);

  // userId comes from the SESSION, never from formData.
  await prisma.savedFilter.upsert({
    where: { userId_page_name: { userId: user.id, page, name } },
    create: { userId: user.id, page, name, query },
    update: { query },
  });
  await writeAudit({ userId: user.id, action: 'savedFilter.create', target: name, payload: { page } });
  revalidatePath(`/${page}`); // `page` is validated by isValidPage, so the path is safe.
}

export async function deleteFilter(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  const page = String(formData.get('page') ?? '');
  if (!id) return;

  // Ownership-scoped: deleteMany with userId means a user can never delete another's filter.
  await prisma.savedFilter.deleteMany({ where: { id, userId: user.id } });
  await writeAudit({ userId: user.id, action: 'savedFilter.delete', target: id });
  if (isValidPage(page)) revalidatePath(`/${page}`);
}
