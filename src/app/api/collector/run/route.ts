import { NextResponse } from 'next/server';
import { authOrE2E } from '@/auth/config';
import { writeAudit } from '@/lib/audit';
import { runAll } from '@/collector/runAll';
import { runCost } from '@/collector/runCost';

export async function POST(req: Request) {
  const session = await authOrE2E(req);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== 'admin') {
    return new NextResponse('forbidden', { status: 403 });
  }
  const url = new URL(req.url);
  const which = url.searchParams.get('kind') ?? 'all';
  if (which === 'cost') {
    await runCost();
  } else if (which === 'inventory') {
    await runAll();
  } else {
    // kind=all or unset: run inventory + cost so billing shows immediately
    await runAll();
    await runCost();
  }
  await writeAudit({ userId: user?.id, action: 'collector.run', target: which });
  return new NextResponse(null, { status: 204 });
}
