import type { Provider } from './types';
import { FakeProvider } from './fake';
import { DockerProvider } from './docker';
import { FirebaseProvider } from './firebase';

const registry = new Map<string, Provider>();
registry.set(FakeProvider.type, FakeProvider);
registry.set(DockerProvider.type, DockerProvider);
registry.set(FirebaseProvider.type, FirebaseProvider);

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
