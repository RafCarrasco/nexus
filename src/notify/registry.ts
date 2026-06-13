import type { Notifier } from './types';
import { inAppNotifier } from './inApp';
import { channelDispatcher } from './dispatcher';

const notifiers: readonly Notifier[] = [inAppNotifier, channelDispatcher];

export function listNotifiers(): readonly Notifier[] {
  return notifiers;
}
