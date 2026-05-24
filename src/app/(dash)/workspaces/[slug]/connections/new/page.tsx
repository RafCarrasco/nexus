import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/db/client';
import { PageHeader } from '@/ui/components/page-header';
import { Button } from '@/ui/components/button';
import { FirebaseWizard } from './firebase-wizard';
import { NewConnectionForm } from '@/app/(dash)/connections/new/new-connection-form';

export const dynamic = 'force-dynamic';

const OTHER_TYPES = ['supabase', 'docker', 'fake'] as const;
type OtherType = (typeof OTHER_TYPES)[number];

export default async function WorkspaceNewConnectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; created?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const type = sp.type ?? 'firebase';
  const isFirebase = type === 'firebase';

  const w = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!w) return notFound();

  const providerToggle = (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-zinc-500 text-xs">Outro provedor:</span>
      <Link href={`/workspaces/${slug}/connections/new` as never}>
        <Button
          variant={isFirebase ? 'default' : 'outline'}
          size="sm"
          className={`rounded-full text-xs h-7 ${isFirebase ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
        >
          firebase
        </Button>
      </Link>
      {OTHER_TYPES.map((t) => (
        <Link key={t} href={`/workspaces/${slug}/connections/new?type=${t}` as never}>
          <Button
            variant={type === t ? 'default' : 'outline'}
            size="sm"
            className={`rounded-full text-xs h-7 ${type === t ? 'bg-zinc-800 hover:bg-zinc-900 text-white' : ''}`}
          >
            {t}
          </Button>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={`Nova conexão · ${w.name}`} action={providerToggle} />

      {sp.created === '1' && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
          ✓ Aplicativo <strong>{w.name}</strong> criado! Adicione a primeira conexão pra começar
          a monitorar.
        </div>
      )}

      {isFirebase ? (
        <FirebaseWizard
          workspaceSlug={w.slug}
          workspaceId={w.id}
          workspaceName={w.name}
        />
      ) : (
        <NewConnectionForm
          fixedWorkspaceId={w.id}
          forcedType={type as OtherType}
          successRedirect={`/workspaces/${slug}` as never}
        />
      )}
    </div>
  );
}
