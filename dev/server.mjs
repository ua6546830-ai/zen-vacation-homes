import http from 'node:http';
import { createPropertyService } from '../functions/property-service.mjs';
import { createChatHandler } from '../functions/sse-chat/handler.mjs';
import { createMemoryDatabase, createMemoryStorage } from './memory-backend.mjs';

const db = createMemoryDatabase(), storage = createMemoryStorage();
const origin = 'http://127.0.0.1:5173';
const properties = createPropertyService({ db, storage, origin, secureCookies: false, getPassword: () => 'local-only-test-password-2026' });
const chat = createChatHandler();

http.createServer(async (incoming, outgoing) => {
  try {
    const chunks = []; let size = 0;
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > 6 * 1024 * 1024) { outgoing.writeHead(413); outgoing.end(); return; }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    const request = new Request(`${origin}${incoming.url}`, { method: incoming.method, headers, ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Buffer.concat(chunks) } : {}) });
    const path = new URL(request.url).pathname;
    let response;
    if (path.startsWith('/__local_upload/') && incoming.method === 'PUT') {
      storage.files.set(decodeURIComponent(path.slice('/__local_upload/'.length)), { bytes: new Uint8Array(Buffer.concat(chunks)), type: headers.get('content-type') });
      response = Response.json({ ok: true });
    } else if (path.includes('/api/chat/')) response = await chat(request);
    else if (path.endsWith('/api/health')) response = Response.json({ ok: true, local: true });
    else response = await properties.handle(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      const reader = response.body.getReader();
      try { while (true) { const { done, value } = await reader.read(); if (done) break; outgoing.write(value); } }
      finally { reader.releaseLock(); }
    }
    outgoing.end();
  } catch {
    if (!outgoing.headersSent) outgoing.writeHead(503, { 'content-type': 'application/json' });
    outgoing.end(JSON.stringify({ error: { code: 'service_unavailable' } }));
  }
}).listen(8000, '127.0.0.1', () => console.log('Local property API: http://127.0.0.1:8000'));
