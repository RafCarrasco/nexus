import type { Provider } from './types';
import { FakeProvider } from './fake';

const registry = new Map<string, Provider>();
registry.set(FakeProvider.type, FakeProvider);

export function registerProvider(p: Provider): void {
  registry.set(p.type, p);
}

export function getProvider(type: string): Provider {
  const p = registry.get(type);
  if (!p) throw new Error(`unknown provider: ${type}`);
  return p;
}

export function listProviderTypes(): string[] {
  return [...registry.keys()];
}
