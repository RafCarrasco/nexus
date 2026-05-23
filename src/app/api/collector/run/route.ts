import { NextResponse } from 'next/server';
import { auth } from '@/auth/config';
import { runAll } from '@/collector/runAll';
import { runCost } from '@/collector/runCost';

export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== 'admin') {
    return new NextResponse('forbidden', { status: 403 });
  }
  const url = new URL(req.url);
  const which = url.searchParams.get('kind') ?? 'all';
  if (which === 'cost') {
    await runCost();
  } else {
    await runAll();
  }
  return new NextResponse(null, { status: 204 });
}
