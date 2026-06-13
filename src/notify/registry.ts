import type { Notifier } from './types';
import { inAppNotifier } from './inApp';
import { channelDispatcher } from './dispatcher';

const notifiers: Notifier[] = [inAppNotifier, channelDispatcher];

export function registerNotifier(n: Notifier): void {
  notifiers.push(n);
}

export function listNotifiers(): readonly Notifier[] {
  return notifiers;
}
