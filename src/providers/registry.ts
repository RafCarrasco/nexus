import type { Provider } from './types';
import { FakeProvider } from './fake';
import { DockerProvider } from './docker';
import { FirebaseProvider } from './firebase';
import { SupabaseProvider } from './supabase';
import { VercelProvider } from './vercel';
import { GitHubProvider } from './github';
import { CloudflareProvider } from './cloudflare';
import { AzureProvider } from './azure';
import { N8nProvider } from './n8n';
import { SentryProvider } from './sentry';

const registry = new Map<string, Provider>();
registry.set(FakeProvider.type, FakeProvider);
registry.set(DockerProvider.type, DockerProvider);
registry.set(FirebaseProvider.type, FirebaseProvider);
registry.set(SupabaseProvider.type, SupabaseProvider);
registry.set(VercelProvider.type, VercelProvider);
registry.set(GitHubProvider.type, GitHubProvider);
registry.set(CloudflareProvider.type, CloudflareProvider);
registry.set(AzureProvider.type, AzureProvider);
registry.set(N8nProvider.type, N8nProvider);
registry.set(SentryProvider.type, SentryProvider);

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
