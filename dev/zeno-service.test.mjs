import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryDatabase } from './memory-backend.mjs';
import { createZenoService } from '../functions/zeno-service.mjs';
import { createCoordinator } from '../functions/coordinator.mjs';
import { retrievePropertyContext } from '../functions/property-retrieval.mjs';
import { listings } from '../functions/catalog.ts';

const uuid = () => crypto.randomUUID();
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

async function fixture(t) {
  const db = createMemoryDatabase();
  const posts = [], controllers = new Set();
  let homes = structuredClone(listings), history = [], gate, unknown = false;
  const entered = deferred();
  const originalFetch = globalThis.fetch;
  const metadata = { fixture: 'credential-free' };
  const session = { id: 'sess_fixture', status: 'idle', agent: { id: 'agent_fixture', version: 1, tools: [] }, environment_id: 'env_fixture', metadata };
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.qoder.com');
    if (url.pathname.endsWith('/events/stream')) {
      let controller;
      const body = new ReadableStream({
        start(value) { controller = value; controllers.add(controller); },
        cancel() { controllers.delete(controller); },
      });
      options.signal?.addEventListener('abort', () => {
        controllers.delete(controller);
        try { controller.close(); } catch {}
      }, { once: true });
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
    }
    if (url.pathname.endsWith('/events') && options.method === 'POST') {
      const command = JSON.parse(options.body);
      posts.push(command);
      entered.resolve();
      if (gate) await gate.promise;
      if (unknown) return Response.json({ error: 'fixture' }, { status: 503 });
      return Response.json({ data: [{ id: `evt_user${posts.length}`, type: 'user.message' }] });
    }
    if (url.pathname.endsWith('/events')) {
      const after = url.searchParams.get('after_id');
      const index = after ? history.findIndex(event => event.id === after) + 1 : 0;
      return Response.json({ data: history.slice(index), has_more: false });
    }
    if (url.pathname.endsWith('/sessions/sess_fixture')) return Response.json(session);
    throw new Error(`Unexpected fixture route: ${url.pathname}`);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const controller of controllers) { try { controller.close(); } catch {} }
  });
  const service = createZenoService({ db, getListings: async () => homes, getToken: () => 'local-fixture-no-credential' });
  const principal = await service.authorize(new Request('http://localhost/', { headers: { 'x-zen-visitor': 'a'.repeat(64) } }));
  const conversation = await service.create(principal, { requestId: uuid() });
  const row = db.tables.get('zen_state').find(value => value.key === `conv:${conversation.id}`);
  row.value.binding = { agent: { id: 'agent_fixture', version: 1 }, environment_id: 'env_fixture' };
  row.value.session = { id: 'sess_fixture', state: 'ready', metadata };
  return {
    db, service, principal, conversation, posts, entered,
    setHomes(value) { homes = value; },
    setUnknown() { unknown = true; },
    hold() { gate = deferred(); return gate; },
    complete(index) {
      history.push({ id: `evt_user${index}`, type: 'user.message' },
        { id: `evt_reply${index}`, type: 'agent.message', content: [{ type: 'text', text: 'Ask your host for the current quote.' }] },
        { id: `evt_idle${index}`, type: 'session.status_idle', stop_reason: { type: 'end_turn' } });
    },
    emit(event) {
      const bytes = new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
      for (const controller of controllers) controller.enqueue(bytes);
    },
  };
}

test('retrieval includes the complete current manifest, ranks relevant details and excludes rates', () => {
  const context = JSON.parse(retrievePropertyContext('Johar penthouse terrace', listings));
  assert.equal(context.currentHomes.length, 7);
  assert.equal(context.relevantDetails[0].path, '/homes/elegant-2br-penthouse-johar');
  assert.equal(context.currentHomes.some(home => Object.hasOwn(home, 'price')), false);
  const changed = JSON.parse(retrievePropertyContext('Johar', listings.filter(home => home.area !== 'johar')));
  assert.equal(changed.currentHomes.some(home => home.path.includes('johar')), false);
  assert.ok(new TextEncoder().encode(retrievePropertyContext('home', listings)).length <= 96000);
});

test('owner capabilities are verified and conversation creation is idempotent', async () => {
  const db = createMemoryDatabase();
  const service = createZenoService({ db, getListings: async () => listings, getToken: () => undefined });
  const owner = await service.authorize(new Request('http://localhost/', { headers: { 'x-zen-visitor': 'a'.repeat(64) } }));
  const other = await service.authorize(new Request('http://localhost/', { headers: { 'x-zen-visitor': 'b'.repeat(64) } }));
  const requestId = uuid();
  const first = await service.create(owner, { requestId });
  assert.equal((await service.create(owner, { requestId })).id, first.id);
  await assert.rejects(service.get(other, first.id), error => error.code === 'forbidden');
  await assert.rejects(service.get({ id: owner.id }, first.id), error => error.code === 'login_required');
  await assert.rejects(service.send(owner, first.id, { requestId: uuid(), text: 'x'.repeat(1001) }), error => error.code === 'invalid_request');
});

test('a prepared intent freezes retrieval, subsequent questions use updated homes, and public history never includes context', async t => {
  const f = await fixture(t);
  const command = { requestId: uuid(), text: 'Help me choose a Johar penthouse.' };
  const controller = new AbortController();
  controller.abort();
  const prepared = await f.service.send(f.principal, f.conversation.id, command, { signal: controller.signal });
  assert.equal(prepared.state, 'pending');
  assert.equal(f.posts.length, 0);
  f.setHomes(listings.filter(home => home.area !== 'johar'));
  assert.equal((await f.service.send(f.principal, f.conversation.id, command)).state, 'running');
  const upstream = f.posts[0].events[0].content[0].text;
  assert.match(upstream, /CURRENT PROPERTY RECORDS/);
  assert.match(upstream, /elegant-2br-penthouse-johar/);
  f.complete(1);
  const completed = await f.service.get(f.principal, f.conversation.id);
  assert.equal(completed.state, 'completed');
  assert.equal(completed.messages[0].text, command.text);
  assert.equal(JSON.stringify(completed).includes('CURRENT PROPERTY RECORDS'), false);
  await f.service.send(f.principal, f.conversation.id, { requestId: uuid(), text: 'What homes are listed now?' });
  assert.equal(f.posts[1].events[0].content[0].text.includes('elegant-2br-penthouse-johar'), false);
  await assert.rejects(f.service.send(f.principal, f.conversation.id, { requestId: command.requestId, text: 'Changed question' }), error => error.code === 'request_conflict');
});

test('unknown upstream writes remain pending and are never redispatched', async t => {
  const f = await fixture(t);
  f.setUnknown();
  const command = { requestId: uuid(), text: 'A family home in DHA' };
  assert.equal((await f.service.send(f.principal, f.conversation.id, command)).state, 'pending');
  assert.equal((await f.service.send(f.principal, f.conversation.id, command)).state, 'pending');
  assert.equal(f.posts.length, 1);
});

test('stream readers wait for a dispatch lease and preserve incremental events', async t => {
  const f = await fixture(t);
  const watch = f.service.watch(f.principal, f.conversation.id);
  t.after(() => watch.return());
  assert.equal((await watch.next()).value.state, 'idle');
  const gate = f.hold();
  const sending = f.service.send(f.principal, f.conversation.id, { requestId: uuid(), text: 'A calm home' });
  await f.entered.promise;
  f.emit({ id: 'evt_user1', type: 'user.message' });
  const reading = watch.next();
  const timer = setTimeout(() => gate.resolve(), 50);
  t.after(() => clearTimeout(timer));
  assert.equal((await sending).state, 'running');
  assert.equal((await reading).value.state, 'running');
  f.emit({ type: 'event_start', event: { id: 'evt_reply1', type: 'agent.message' } });
  await watch.next();
  f.emit({ type: 'event_delta', event_id: 'evt_reply1', delta: { type: 'content_delta', index: 0, content: { type: 'text', text: 'A calm ' } } });
  assert.equal((await watch.next()).value.messages.at(-1).text, 'A calm ');
  f.emit({ type: 'event_delta', event_id: 'evt_reply1', delta: { type: 'content_delta', index: 0, content: { type: 'text', text: 'stay.' } } });
  assert.equal((await watch.next()).value.messages.at(-1).text, 'A calm stay.');
  f.emit({ id: 'evt_reply1', type: 'agent.message', content: [{ type: 'text', text: 'A calm stay.' }] });
  await watch.next();
  f.emit({ id: 'evt_idle1', type: 'session.status_idle', stop_reason: { type: 'end_turn' } });
  assert.equal((await watch.next()).value.state, 'completed');
});

test('an expired coordinator generation cannot overwrite or unlock its successor', async t => {
  const db = createMemoryDatabase(), coordinator = createCoordinator(db);
  const oldNow = Date.now;
  let now = oldNow();
  Date.now = () => now;
  t.after(() => { Date.now = oldNow; });
  const entered = deferred(), release = deferred();
  const old = coordinator.withLock('fence-test', async lease => {
    await lease.write({ generation: 'old' });
    entered.resolve();
    await release.promise;
    await lease.write({ generation: 'stale' });
  });
  const rejection = assert.rejects(old, error => error.code === 'dispatch_unknown');
  await entered.promise;
  await assert.rejects(coordinator.withLock('fence-test', () => {}), error => error.code === 'dispatch_unknown');
  now += 90001;
  await coordinator.withLock('fence-test', lease => lease.write({ generation: 'new' }));
  release.resolve();
  await rejection;
  assert.deepEqual(await coordinator.readState('fence-test'), { generation: 'new' });
  assert.equal(db.tables.get('zen_state').find(row => row.key === 'fence-test').token, '');
});
