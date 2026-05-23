/**
 * When NEXUS_E2E=1, middleware skips Google SSO and treats requests
 * as an admin session keyed off a fake header.
 */
export function e2eSession(req: Request): { user: { id: string; email: string; role: 'admin' } } | null {
  if (process.env.NEXUS_E2E !== '1') return null;
  if (req.headers.get('x-nexus-e2e') !== '1') return null;
  return { user: { id: 'e2e-admin', email: 'e2e@procurementgarage.com', role: 'admin' } };
}
