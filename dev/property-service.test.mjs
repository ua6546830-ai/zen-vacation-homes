import test from 'node:test';
import assert from 'node:assert/strict';
import { createPropertyService } from '../functions/property-service.mjs';
import { createMemoryDatabase, createMemoryStorage } from './memory-backend.mjs';

const origin = 'http://127.0.0.1:5173';
const testPassword = 'local-only-test-password-2026';
const setup = (configured = true) => {
  const db = createMemoryDatabase(), storage = createMemoryStorage();
  const service = createPropertyService({ db, storage, origin, getPassword: () => configured ? testPassword : undefined, secureCookies: false });
  const request = async (path, method = 'GET', body, cookie, requestId) => {
    const response = await service.handle(new Request(`${origin}/functions/v1/app${path}`, {
      method, headers: { ...(method !== 'GET' ? { origin, 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(requestId ? { 'idempotency-key': requestId } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }));
    return { response, value: response.headers.get('content-type')?.includes('application/json') ? await response.clone().json() : undefined };
  };
  const login = async () => {
    const result = await request('/api/admin/login', 'POST', { password: testPassword });
    assert.equal(result.response.status, 200);
    return result.response.headers.get('set-cookie').split(';')[0];
  };
  return { db, storage, service, request, login };
};

test('admin remains locked without configuration or authentication', async () => {
  const { request } = setup(false);
  assert.deepEqual((await request('/api/admin/session')).value, { configured: false, authenticated: false });
  assert.equal((await request('/api/admin/login', 'POST', { password: testPassword })).response.status, 503);
  assert.equal((await setup().request('/api/admin/properties')).response.status, 401);
});

test('sessions are private, revocable and reject forged identity headers and cross-origin writes', async () => {
  const { request, login, service } = setup();
  const cookie = await login();
  assert.equal((await request('/api/admin/session', 'GET', undefined, cookie)).value.authenticated, true);
  const forged = await service.handle(new Request(`${origin}/functions/v1/app/api/admin/properties`, { headers: { 'x-qoder-user-context': 'forged', cookie: 'zen_admin_local=bad' } }));
  assert.equal(forged.status, 401);
  const crossOrigin = await service.handle(new Request(`${origin}/functions/v1/app/api/admin/logout`, { method: 'POST', headers: { origin: 'https://example.invalid', 'content-type': 'application/json', cookie }, body: '{}' }));
  assert.equal(crossOrigin.status, 403);
  assert.equal((await request('/api/admin/logout', 'POST', {}, cookie)).response.status, 200);
  assert.equal((await request('/api/admin/properties', 'GET', undefined, cookie)).response.status, 401);
});

test('property writes update public records, reject stale versions and do not resurrect deletes', async () => {
  const { request, login } = setup();
  const cookie = await login();
  const originals = (await request('/api/admin/properties', 'GET', undefined, cookie)).value.properties;
  assert.equal(originals.length, 7);
  assert.ok(originals.every(item => !('price' in item.listing)));
  const first = originals[0];
  const listing = { ...first.listing, name: 'Updated host-approved home' };
  const changed = await request(`/api/admin/properties/${listing.slug}`, 'PATCH', { listing, published: true, version: first.version }, cookie);
  assert.equal(changed.response.status, 200);
  assert.equal(changed.value.property.version, 2);
  assert.equal((await request('/api/properties')).value.properties[0].name, listing.name);
  assert.equal((await request(`/api/admin/properties/${listing.slug}`, 'PATCH', { listing, published: true, version: first.version }, cookie)).response.status, 409);
  assert.equal((await request(`/api/admin/properties/${listing.slug}`, 'DELETE', { version: 2 }, cookie)).response.status, 200);
  assert.equal((await request('/api/properties')).value.properties.length, 6);
});

test('create recovers its exact request, keeps drafts private and validates gallery paths', async () => {
  const { request, login } = setup();
  const cookie = await login();
  const original = (await request('/api/properties')).value.properties[0];
  const listing = { ...original, slug: 'test-draft-home', name: 'Test draft', photos: [] };
  const requestId = crypto.randomUUID();
  const first = await request('/api/admin/properties', 'POST', { listing, published: false }, cookie, requestId);
  assert.equal(first.response.status, 201);
  assert.equal((await request('/api/admin/properties', 'POST', { listing, published: false }, cookie, requestId)).value.property.version, 1);
  assert.equal((await request('/api/admin/properties', 'POST', { listing: { ...listing, name: 'Different request' }, published: false }, cookie, requestId)).response.status, 409);
  assert.equal((await request('/api/properties')).value.properties.some(item => item.slug === listing.slug), false);
  assert.equal((await request(`/api/admin/properties/${listing.slug}`, 'PATCH', { listing, published: true, version: 1 }, cookie)).response.status, 400);
  const invalid = { ...listing, photos: [{ src: 'https://example.invalid/arbitrary.svg', alt: 'Unsafe image' }] };
  assert.equal((await request(`/api/admin/properties/${listing.slug}`, 'PATCH', { listing: invalid, published: false, version: 1 }, cookie)).response.status, 400);
});

test('uploaded photos are verified, private until published and cannot be rebound to other homes', async () => {
  const { request, login, storage } = setup();
  const cookie = await login();
  const listing = (await request('/api/properties')).value.properties[0];
  const bytes = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
  const id = crypto.randomUUID();
  const intent = await request(`/api/admin/properties/${listing.slug}/uploads`, 'POST', { filename: 'room.png', size: bytes.length, mimeType: 'image/png' }, cookie, id);
  assert.equal(intent.response.status, 201);
  assert.equal((await request(`/api/admin/uploads/${id}/complete`, 'POST', {}, cookie)).response.status, 409);
  storage.files.set(`zen-properties/${id}`, { bytes, type: 'image/png' });
  const completed = await request(`/api/admin/uploads/${id}/complete`, 'POST', {}, cookie);
  assert.equal(completed.response.status, 200);
  assert.equal((await request(`/api/property-images/${id}`)).response.status, 401);
  const changed = { ...listing, photos: [...listing.photos, completed.value.photo] };
  assert.equal((await request(`/api/admin/properties/${listing.slug}`, 'PATCH', { listing: changed, published: true, version: 1 }, cookie)).response.status, 200);
  const publicPhoto = await request(`/api/property-images/${id}`);
  assert.equal(publicPhoto.response.status, 200);
  assert.deepEqual(new Uint8Array(await publicPhoto.response.arrayBuffer()), bytes);
  const other = (await request('/api/properties')).value.properties[1];
  assert.equal((await request(`/api/admin/properties/${other.slug}`, 'PATCH', { listing: { ...other, photos: [completed.value.photo] }, published: true, version: 1 }, cookie)).response.status, 400);
});
