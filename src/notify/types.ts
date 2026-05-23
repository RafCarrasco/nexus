import type { Incident, Resource } from '@prisma/client';

export interface Notifier {
  readonly id: string;
  notify(incident: Incident, resource: Resource): Promise<void>;
}
