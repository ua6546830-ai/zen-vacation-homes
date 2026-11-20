import { createDatabaseClient, createSiteContext } from './_qoder/backend.mjs';
import { createStorageClient } from './_qoder/storage.mjs';
import { createChatHandler } from './sse-chat/handler.mjs';
import { createZenoService } from './zeno-service.mjs';
import { createPropertyService } from './property-service.mjs';

const siteOrigin = 'https://zen-vacation-homes-1oqxsipmfn5.qoder.website';
const db = createDatabaseClient();
const properties = createPropertyService({ db, storage: createStorageClient(), origin: siteOrigin, getPassword: () => Deno.env.get('APP_ADMIN_PASSWORD') });
const service = createZenoService({ db, getListings: () => properties.listPublic() });
const chat = createChatHandler({ service, streamLifetimeMs: 45000 });

Deno.serve(async incoming => {
  try {
    const request = createSiteContext(incoming, { forwardApplicationCredentials: true }).request;
    const path = new URL(request.url).pathname.replace(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(?=\/|$)/, '');
    if (path === '/api/health' && request.method === 'GET') {
      return Response.json({ ok: true, revision: 'zen-admin-2026-11-20-2' }, { headers: { 'cache-control': 'no-store' } });
    }
    if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== siteOrigin) {
      return Response.json({ error: { code: 'forbidden' } }, { status: 403 });
    }
    if (path === '/api/properties' || path.startsWith('/api/admin/') || path.startsWith('/api/property-images/')) return await properties.handle(request);
    return await chat(request);
  } catch {
    return Response.json({ error: { code: 'service_unavailable', diagnosticId: crypto.randomUUID() } }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
});
