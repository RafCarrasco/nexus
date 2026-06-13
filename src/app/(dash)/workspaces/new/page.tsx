import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/db/client';
import { auth } from '@/auth/config';
import { PageHeader } from '@/ui/components/page-header';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

async function createWorkspace(formData: FormData) {
  'use server';
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin' && role !== 'member') {
    throw new Error('forbidden');
  }
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  if (!name) throw new Error('name required');
  let slug = slugify(name);
  if (!slug) slug = 'app-' + Date.now();
  // de-dupe slug
  let i = 1;
  let candidate = slug;
  while (await prisma.workspace.findUnique({ where: { slug: candidate } })) {
    i += 1;
    candidate = `${slug}-${i}`;
  }
  await prisma.workspace.create({ data: { name, description, slug: candidate } });
  revalidatePath('/workspaces');
  redirect(`/workspaces/${candidate}/connections/new?created=1` as never);
}

export default function NewWorkspacePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Novo aplicativo" />
      <form action={createWorkspace} className="max-w-xl space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="space-y-1">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" required placeholder="Mapa Comparativo" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Input id="description" name="description" placeholder="Painel de comparação de fornecedores" />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl">Salvar</Button>
        </div>
      </form>
    </div>
  );
}
