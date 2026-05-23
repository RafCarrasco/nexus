import type { Notifier } from './types';
import { inAppNotifier } from './inApp';

const notifiers: Notifier[] = [inAppNotifier];

export function registerNotifier(n: Notifier): void {
  notifiers.push(n);
}

export function listNotifiers(): readonly Notifier[] {
  return notifiers;
}
