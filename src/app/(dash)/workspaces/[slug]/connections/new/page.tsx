import { notFound } from 'next/navigation';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { NewConnectionForm } from '@/app/(dash)/connections/new/new-connection-form';

export const dynamic = 'force-dynamic';

export default async function WorkspaceNewConnectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { slug } = await params;
  const { created } = await searchParams;

  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!workspace) return notFound();

  const banner = created === '1'
    ? `Aplicativo "${workspace.name}" criado! Agora adicione a primeira conexão.`
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Nova conexão" />
      <NewConnectionForm
        fixedWorkspaceId={workspace.id}
        successRedirect={`/workspaces/${slug}`}
        banner={banner}
      />
    </div>
  );
}
