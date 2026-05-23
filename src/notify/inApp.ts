import type { Notifier } from './types';

/**
 * Incident rows are created by the collector. The in-app channel does
 * nothing on top of that — the UI surfaces the row directly. This file
 * exists so the dispatch loop has at least one channel to call.
 */
export const inAppNotifier: Notifier = {
  id: 'in-app',
  async notify() {
    /* no-op */
  },
};
