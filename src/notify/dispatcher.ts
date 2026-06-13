import type { Incident, NotificationChannel } from '@prisma/client';
import { prisma } from '@/db/client';
import { decrypt } from '@/crypto/vault';
import { fetchWithTimeout, isSafePublicHttpUrl } from '@/lib/http';
import { formatPayload, type ChannelType } from '@/lib/notify-format';
import { log } from '@/lib/logger';
import type { IncidentContext, Notifier } from './types';

type ChannelConfig = { url?: string; host?: string; port?: number; user?: string; pass?: string; from?: string; to?: string };

const HTTP_TYPES = new Set<ChannelType>(['webhook', 'slack', 'teams']);

/** Replace every literal occurrence of the channel URL in a message so secrets never persist/log. */
function scrubUrl(message: string, url: string | undefined): string {
  if (!url) return message;
  return message.split(url).join('[url]');
}

/** Decrypt a channel's config blob; returns null (and never throws) on failure. */
function loadConfig(ch: NotificationChannel): ChannelConfig | null {
  try {
    return decrypt<ChannelConfig>(Buffer.from(ch.config));
  } catch (e) {
    log.warn('channel config decrypt failed', { channel: ch.id, err: (e as Error).message });
    return null;
  }
}

/**
 * Deliver one incident to one channel. Persists lastFiredAt/lastError and NEVER throws.
 * The decrypted url is used only to POST and is scrubbed out of anything stored or logged.
 */
async function deliver(ch: NotificationChannel, incident: Incident, ctx: IncidentContext): Promise<void> {
  const cfg = loadConfig(ch);
  if (!cfg) {
    await recordResult(ch.id, 'config inválida (falha ao decriptar)');
    return;
  }

  // Email isn't wired to an SMTP transport yet — record a clear, url-free error.
  if (ch.type === 'email') {
    await recordResult(ch.id, 'canal email ainda não implementado (sem transporte SMTP)');
    return;
  }

  const url = cfg.url;
  if (!url || !isSafePublicHttpUrl(url)) {
    await recordResult(ch.id, 'URL ausente ou aponta para rede interna');
    return;
  }

  try {
    const body = formatPayload(ch.type as ChannelType, incident, ctx);
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'manual',
      },
      5000,
    );
    // res.ok is 2xx only; with redirect:'manual' a 3xx is NOT a delivery — treat as error.
    if (res.ok) {
      await recordResult(ch.id, null);
    } else {
      await recordResult(ch.id, `resposta http ${res.status}`);
    }
  } catch (e) {
    const raw = (e as Error).message ?? 'erro desconhecido';
    await recordResult(ch.id, scrubUrl(raw, url));
  }
}

/** Persist the outcome of a delivery. Best-effort: a DB hiccup here must not throw. */
async function recordResult(channelId: string, error: string | null): Promise<void> {
  try {
    await prisma.notificationChannel.update({
      where: { id: channelId },
      data: { lastFiredAt: new Date(), lastError: error },
    });
    if (error) log.warn('channel delivery failed', { channel: channelId, err: error });
  } catch (e) {
    log.warn('channel result persist failed', { channel: channelId, err: (e as Error).message });
  }
}

/** Whether a channel wants this phase. */
function wantsPhase(ch: NotificationChannel, phase: 'open' | 'resolve'): boolean {
  return phase === 'open' ? ch.notifyOnOpen : ch.notifyOnResolve;
}

/**
 * The outbound channel dispatcher. Loads every enabled channel, filters by phase, and
 * fires them all with Promise.allSettled so N slow webhooks can't serialize/stall the
 * collector's per-connection lock window. Never throws.
 */
export const channelDispatcher: Notifier = {
  id: 'channels',
  async notify(incident: Incident, ctx: IncidentContext): Promise<void> {
    let channels: NotificationChannel[];
    try {
      channels = await prisma.notificationChannel.findMany({ where: { enabled: true } });
    } catch (e) {
      log.warn('channel load failed', { err: (e as Error).message });
      return;
    }
    const targets = channels.filter((c) => wantsPhase(c, ctx.phase));
    if (targets.length === 0) return;
    await Promise.allSettled(targets.map((c) => deliver(c, incident, ctx)));
  },
};

/** Run the dispatcher against a single channel (used by the "Testar" action). Never throws. */
export async function dispatchToChannel(ch: NotificationChannel, incident: Incident, ctx: IncidentContext): Promise<void> {
  await deliver(ch, incident, ctx);
}
