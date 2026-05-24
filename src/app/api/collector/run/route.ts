import { NextResponse } from 'next/server';
import { authOrE2E } from '@/auth/config';
import { runAll } from '@/collector/runAll';
import { runCost } from '@/collector/runCost';

export async function POST(req: Request) {
  const session = await authOrE2E(req);
  if ((session?.user as { role?: string })?.role !== 'admin') {
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
  return new NextResponse(null, { status: 204 });
}
