import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { NewConnectionForm } from './new-connection-form';

export const dynamic = 'force-dynamic';

export default async function NewConnectionPage() {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Nova conexão" />
      <NewConnectionForm workspaces={workspaces} />
    </div>
  );
}
