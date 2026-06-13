'use server';
import { prisma } from '@/db/client';
// Channels carry secrets — gate every mutation behind admin, like settings/clients.
import { requireAdmin } from '@/auth/guards';
import { writeAudit } from '@/lib/audit';
import { encrypt } from '@/crypto/vault';
import { isSafePublicHttpUrl } from '@/lib/http';
import { dispatchToChannel } from '@/notify/dispatcher';
import { revalidatePath } from 'next/cache';
import type { Incident } from '@prisma/client';
import type { IncidentContext } from '@/notify/types';

const CHANNEL_TYPES = new Set(['webhook', 'slack', 'teams', 'email']);

export async function createChannel(formData: FormData) {
  const user = await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? '').trim();
  const notifyOnOpen = formData.get('notifyOnOpen') != null;
  const notifyOnResolve = formData.get('notifyOnResolve') != null;
  if (!name) return;
  if (!CHANNEL_TYPES.has(type)) throw new Error('tipo de canal inválido');

  let config: Record<string, unknown>;
  if (type === 'email') {
    const host = String(formData.get('host') ?? '').trim();
    const port = Number(formData.get('port') ?? 587) || 587;
    const smtpUser = String(formData.get('user') ?? '').trim();
    const pass = String(formData.get('pass') ?? '');
    const from = String(formData.get('from') ?? '').trim();
    const to = String(formData.get('to') ?? '').trim();
    if (!host || !from || !to) throw new Error('host, from e to são obrigatórios para email');
    config = { host, port, user: smtpUser, pass, from, to };
  } else {
    const url = String(formData.get('url') ?? '').trim();
    if (!url) throw new Error('URL é obrigatória');
    if (!isSafePublicHttpUrl(url)) throw new Error('URL inválida ou aponta para rede interna');
    config = { url };
  }

  const row = await prisma.notificationChannel.create({
    data: {
      name,
      type,
      config: encrypt(config) as unknown as Uint8Array<ArrayBuffer>,
      notifyOnOpen,
      notifyOnResolve,
    },
  });
  // Audit records name + type only — never the url or SMTP secrets.
  await writeAudit({ userId: user?.id, action: 'channel.create', target: row.id, payload: { name, type } });
  revalidatePath('/settings/channels');
}

export async function deleteChannel(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const row = await prisma.notificationChannel.findUnique({ where: { id }, select: { name: true, type: true } });
  await prisma.notificationChannel.delete({ where: { id } });
  await writeAudit({ userId: user?.id, action: 'channel.delete', target: id, payload: row ?? undefined });
  revalidatePath('/settings/channels');
}

export async function toggleChannel(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const row = await prisma.notificationChannel.findUnique({ where: { id }, select: { enabled: true } });
  if (!row) return;
  await prisma.notificationChannel.update({ where: { id }, data: { enabled: !row.enabled } });
  await writeAudit({ userId: user?.id, action: 'channel.toggle', target: id, payload: { enabled: !row.enabled } });
  revalidatePath('/settings/channels');
}

export async function testChannel(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const channel = await prisma.notificationChannel.findUnique({ where: { id } });
  if (!channel) return;

  // Synthetic incident + context fed through the real dispatcher against this one channel.
  const now = new Date();
  const incident: Incident = {
    id: `test-${id}`,
    resourceId: null,
    uptimeCheckId: null,
    alertRuleId: null,
    type: 'test',
    severity: 'info',
    message: 'Mensagem de teste do Nexus — se você recebeu isto, o canal está funcionando.',
    openedAt: now,
    resolvedAt: null,
    payload: null,
  };
  const ctx: IncidentContext = {
    source: 'resource',
    label: channel.name,
    kind: 'test',
    phase: 'open',
  };
  // dispatchToChannel never throws and persists lastError (scrubbed) on the row.
  await dispatchToChannel(channel, incident, ctx);
  revalidatePath('/settings/channels');
}
