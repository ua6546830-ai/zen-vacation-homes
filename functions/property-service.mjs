import { listings as initialListings } from './catalog.ts';
import { createCoordinator } from './coordinator.mjs';
import { ChatError } from './sse-chat/handler.mjs';

const CATALOG = 'zen:property-catalog:v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHOTO = /^\/functions\/v1\/app\/api\/property-images\/([0-9a-f-]{36})$/;
const MIME = ['image/jpeg', 'image/png', 'image/webp'];
const AMENITIES = ['wifi', 'ac', 'kitchen', 'fridge', 'microwave', 'iron', 'tv', 'washer', 'lift', 'parking', 'terrace', 'balcony', 'view', 'dining', 'utilities', 'servant', 'caretaker', 'nearby'];
const ICONS = ['lift', 'store', 'bath', 'terrace', 'view', 'shield', 'parking', 'family', 'tv', 'balcony', 'sparkles'];
const encoder = new TextEncoder();
const cookieName = '__Host-zen_admin';
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join('');
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');

class PropertyError extends ChatError {
  constructor(code, status = 400) { super(code); this.status = status; }
}
const fail = (code, status) => { throw new PropertyError(code, status); };
const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers: { 'cache-control': 'no-store', ...headers } });
const rows = result => { if (result.error) fail('service_unavailable', 503); return result.data ?? []; };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

async function readBytes(response, limit, timeoutMs = 15000) {
  if (!response.body) fail('invalid_input');
  const reader = response.body.getReader();
  const chunks = []; let size = 0, timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, timeoutMs);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) fail('service_unavailable', 503);
      if (done) break;
      size += value.byteLength;
      if (size > limit) fail('payload_too_large', 413);
      chunks.push(value);
    }
  } finally { clearTimeout(timer); await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function input(request, limit = 64000) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') fail('invalid_input');
  const bytes = await readBytes(request, limit);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail('invalid_input'); }
  if (!record(value)) fail('invalid_input');
  return value;
}

function text(value, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail('invalid_input');
  return value.trim();
}
function integer(value, max, min = 1) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('invalid_input');
  return value;
}
function lines(value, count, max) {
  if (!Array.isArray(value) || value.length > count) fail('invalid_input');
  return value.map(item => text(item, max));
}
function normalizeListing(value) {
  if (!record(value)) fail('invalid_input');
  const slug = text(value.slug, 100);
  if (!SLUG.test(slug) || !['Apartment', 'Penthouse', 'Portion'].includes(value.type) || !['dha', 'gulshan', 'johar'].includes(value.area)) fail('invalid_input');
  if (!Array.isArray(value.amenities) || value.amenities.length > AMENITIES.length || value.amenities.some(item => !AMENITIES.includes(item))) fail('invalid_input');
  if (!Array.isArray(value.photos) || value.photos.length > 30 || !Array.isArray(value.highlights) || value.highlights.length > 8) fail('invalid_input');
  const listing = {
    slug, name: text(value.name, 120), type: value.type, area: value.area,
    locality: text(value.locality, 200, false), address: text(value.address, 400, false), mapQuery: text(value.mapQuery, 400, false),
    bedrooms: integer(value.bedrooms, 20, 0), bathrooms: integer(value.bathrooms, 20),
    summary: text(value.summary, 1000, false), about: lines(value.about, 12, 4000), space: lines(value.space, 30, 500),
    highlights: value.highlights.map(item => {
      if (!record(item) || !ICONS.includes(item.icon)) fail('invalid_input');
      return { icon: item.icon, title: text(item.title, 100), text: text(item.text, 500) };
    }),
    amenities: [...new Set(value.amenities)],
    photos: value.photos.map(item => {
      if (!record(item)) fail('invalid_input');
      const src = text(item.src, 300);
      if (!/^\/listings\/[a-z0-9-]+\/[0-9]{2}\.(?:webp|png|jpe?g)$/.test(src) && !(PHOTO.test(src) && UUID.test(src.match(PHOTO)[1]))) fail('invalid_input');
      const photo = { src, alt: text(item.alt, 300) };
      if (item.caption !== undefined) {
        const caption = text(item.caption, 1000, false);
        if (caption) photo.caption = caption;
      }
      return photo;
    }),
  };
  if (value.floor) listing.floor = text(value.floor, 200);
  if (value.beds !== undefined) listing.beds = integer(value.beds, 50);
  if (value.maxGuests !== undefined) listing.maxGuests = integer(value.maxGuests, 50);
  if (value.safetyNotes !== undefined) listing.safetyNotes = lines(value.safetyNotes, 20, 500);
  if (value.sleeping !== undefined) {
    if (!Array.isArray(value.sleeping) || value.sleeping.length > 20) fail('invalid_input');
    listing.sleeping = value.sleeping.map(item => ({ room: text(item?.room, 100), beds: text(item?.beds, 300) }));
  }
  if (value.airbnb !== undefined) {
    if (!record(value.airbnb)) fail('invalid_input');
    let url;
    try { url = new URL(value.airbnb.url); } catch { fail('invalid_input'); }
    if (url.protocol !== 'https:' || !/^(?:www\.)?airbnb\.(?:com|ie)$/.test(url.hostname) || !/^\/rooms\/[0-9]+\/?$/.test(url.pathname) || url.username || url.password) fail('invalid_input');
    if (typeof value.airbnb.rating !== 'number' || value.airbnb.rating < 0 || value.airbnb.rating > 5 || typeof value.airbnb.guestFavourite !== 'boolean') fail('invalid_input');
    listing.airbnb = { url: url.href, rating: value.airbnb.rating, reviews: integer(value.airbnb.reviews, 100000, 0), guestFavourite: value.airbnb.guestFavourite };
  }
  if (encoder.encode(JSON.stringify(listing)).length > 32000) fail('payload_too_large', 413);
  return listing;
}

export function createPropertyService({ db, storage, origin, getPassword = () => undefined, secureCookies = true }) {
  const coordinator = createCoordinator(db);
  const name = secureCookies ? cookieName : 'zen_admin_local';
  const seed = () => ({ revision: 1, properties: initialListings.map(listing => ({ listing: normalizeListing(listing), published: true, version: 1 })), commands: [] });
  const readValue = async key => rows(await db.from('zen_state').select('value').eq('key', key).limit(1))[0]?.value;
  const catalog = async () => (await readValue(CATALOG)) ?? seed();
  const sessionKey = async token => `zen:admin-session:${await hash(token)}`;
  const password = () => { const value = getPassword(); return typeof value === 'string' && value.length >= 16 && value.length <= 256 ? value : undefined; };
  const cookie = (token, maxAge) => `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`;
  async function session(request) {
    const secret = password();
    if (!secret) return null;
    const header = request.headers.get('cookie') ?? '';
    if (header.length > 8192) return null;
    const candidates = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
    if (candidates.length !== 1) return null;
    const token = candidates[0].slice(name.length + 1);
    if (!/^[0-9a-f]{64}$/.test(token)) return null;
    const value = await readValue(await sessionKey(token));
    if (!value || value.expiresAt <= Date.now() || value.passwordTag !== await hash(`zen:admin-password:${secret}`)) return null;
    return { token };
  }
  async function authorize(request) {
    if (!password()) fail('admin_not_configured', 503);
    const current = await session(request);
    if (!current) fail('login_required', 401);
    return current;
  }
  async function validatePhotos(listing) {
    for (const photo of listing.photos) {
      const match = photo.src.match(PHOTO);
      if (!match) continue;
      const upload = await readValue(`zen:property-upload:${match[1]}`);
      if (!upload || upload.status !== 'ready' || upload.slug !== listing.slug) fail('invalid_input');
    }
  }
  async function login(request) {
    const secret = password();
    if (!secret) fail('admin_not_configured', 503);
    const body = await input(request, 2048);
    const candidate = text(body.password, 256);
    await coordinator.withLock('zen:admin-login-limiter', async lease => {
      const previous = await readValue('zen:admin-login-limiter');
      const now = Date.now();
      const value = previous && previous.resetAt > now ? previous : { count: 0, resetAt: now + 15 * 60000 };
      if (value.count >= 30) fail('too_many_attempts', 429);
      await lease.write({ ...value, count: value.count + 1 });
    });
    const a = await hash(secret), b = await hash(candidate);
    let difference = 0;
    for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
    if (difference) fail('forbidden', 403);
    const token = randomToken();
    rows(await db.from('zen_state').insert({ key: await sessionKey(token), version: 1, token: '', expires_at: 0, value: { expiresAt: Date.now() + 8 * 3600000, passwordTag: await hash(`zen:admin-password:${secret}`) } }));
    return json({ authenticated: true }, 200, { 'set-cookie': cookie(token, 8 * 3600) });
  }
  async function save(request, slug) {
    const body = await input(request);
    const listing = normalizeListing(body.listing);
    if (typeof body.published !== 'boolean') fail('invalid_input');
    if (body.published && (!listing.photos.length || !listing.about.length || !listing.locality || !listing.address || !listing.mapQuery || !listing.summary)) fail('invalid_input');
    if (slug && slug !== listing.slug) fail('invalid_input');
    await validatePhotos(listing);
    const requestId = request.headers.get('idempotency-key');
    if (!slug && !UUID.test(requestId ?? '')) fail('invalid_input');
    if (slug) integer(body.version, Number.MAX_SAFE_INTEGER - 1);
    const fingerprint = await hash(JSON.stringify({ listing, published: body.published }));
    const result = await coordinator.withLock(CATALOG, async lease => {
      const value = await catalog();
      if (!slug) {
        const command = value.commands.find(item => item.id === requestId);
        if (command) {
          if (command.fingerprint !== fingerprint) fail('idempotency_conflict', 409);
          const recovered = value.properties.find(item => item.listing.slug === command.slug);
          if (!recovered) fail('write_conflict', 409);
          return recovered;
        }
      }
      const index = value.properties.findIndex(item => item.listing.slug === listing.slug);
      if (slug && (index < 0 || value.properties[index].version !== body.version)) fail('write_conflict', 409);
      if (!slug && (index >= 0 || value.properties.length >= 50)) fail('write_conflict', 409);
      const property = { listing, published: body.published, version: slug ? body.version + 1 : 1 };
      const properties = value.properties.slice();
      if (index < 0) properties.push(property); else properties[index] = property;
      const commands = slug ? value.commands : [...value.commands, { id: requestId, fingerprint, slug: listing.slug }].slice(-100);
      await lease.write({ revision: value.revision + 1, properties, commands });
      return property;
    });
    return json({ property: result }, slug ? 200 : 201);
  }
  async function remove(request, slug) {
    const body = await input(request, 2048);
    integer(body.version, Number.MAX_SAFE_INTEGER - 1);
    await coordinator.withLock(CATALOG, async lease => {
      const value = await catalog();
      const property = value.properties.find(item => item.listing.slug === slug);
      if (!property || property.version !== body.version) fail('write_conflict', 409);
      await lease.write({ ...value, revision: value.revision + 1, properties: value.properties.filter(item => item.listing.slug !== slug) });
    });
    return json({ deleted: true });
  }
  async function upload(request, slug) {
    const body = await input(request, 2048), id = request.headers.get('idempotency-key');
    if (!UUID.test(id ?? '') || !MIME.includes(body.mimeType)) fail('invalid_input');
    const size = integer(body.size, 5 * 1024 * 1024);
    const filename = text(body.filename, 200);
    if (!(await catalog()).properties.some(item => item.listing.slug === slug)) fail('not_found', 404);
    const key = `zen:property-upload:${id}`;
    const value = await coordinator.withLock(key, async lease => {
      const previous = await readValue(key);
      if (previous) {
        if (previous.slug !== slug || previous.size !== size || previous.mimeType !== body.mimeType || previous.filename !== filename) fail('idempotency_conflict', 409);
        if (previous.status !== 'pending') fail('write_conflict', 409);
        return previous;
      }
      const intent = { slug, size, mimeType: body.mimeType, filename, status: 'pending', objectPath: `zen-properties/${id}`, createdAt: Date.now() };
      await lease.write(intent);
      return intent;
    });
    const signed = await storage.createSignedUploadUrl(value.objectPath, { upsert: false });
    if (typeof signed.signedUrl !== 'string' || !/^\/(?!\/)/.test(signed.signedUrl)) fail('service_unavailable', 503);
    return json({ id, signedUrl: signed.signedUrl }, 201);
  }
  async function complete(id) {
    const key = `zen:property-upload:${id}`;
    const intent = await readValue(key);
    if (!intent) fail('not_found', 404);
    if (intent.status !== 'ready') {
      let response;
      try { response = await storage.download(intent.objectPath); }
      catch (error) { if (error?.code === 'storage_object_not_found') fail('upload_pending', 409); throw error; }
      const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (!response.ok || type !== intent.mimeType) { await response.body?.cancel(); fail('invalid_upload', 422); }
      const bytes = await readBytes(response, 5 * 1024 * 1024);
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte);
      const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
      if (bytes.length !== intent.size || !(type === 'image/jpeg' ? jpeg : type === 'image/png' ? png : webp)) fail('invalid_upload', 422);
      await coordinator.withLock(key, async lease => {
        const latest = await readValue(key);
        if (!latest || latest.objectPath !== intent.objectPath) fail('write_conflict', 409);
        await lease.write({ ...latest, status: 'ready' });
      });
    }
    return json({ photo: { src: `/functions/v1/app/api/property-images/${id}`, alt: intent.filename.replace(/\.[^.]+$/, '') } });
  }
  async function image(request, id) {
    const value = await readValue(`zen:property-upload:${id}`);
    if (!value || value.status !== 'ready') fail('not_found', 404);
    const src = `/functions/v1/app/api/property-images/${id}`;
    const publicImage = (await catalog()).properties.some(item => item.published && item.listing.photos.some(photo => photo.src === src));
    if (!publicImage) await authorize(request);
    const response = await storage.download(value.objectPath);
    if (!response.ok) fail('service_unavailable', 503);
    return new Response(response.body, { headers: { 'content-type': value.mimeType, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" } });
  }
  const listPublic = async () => (await catalog()).properties.filter(item => item.published).map(item => item.listing);
  return {
    listPublic,
    async handle(request) {
      const diagnosticId = crypto.randomUUID();
      try {
        const path = new URL(request.url).pathname.replace(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(?=\/|$)/, '');
        if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== origin) fail('forbidden', 403);
        if (path === '/api/properties' && request.method === 'GET') return json({ properties: await listPublic() });
        const photo = path.match(/^\/api\/property-images\/([0-9a-f-]{36})$/);
        if (photo && UUID.test(photo[1]) && request.method === 'GET') return await image(request, photo[1]);
        if (path === '/api/admin/session' && request.method === 'GET') return json({ configured: Boolean(password()), authenticated: Boolean(await session(request)) });
        if (path === '/api/admin/login' && request.method === 'POST') return await login(request);
        const current = await authorize(request);
        if (path === '/api/admin/logout' && request.method === 'POST') {
          await input(request, 2048);
          rows(await db.from('zen_state').update({ value: null }).eq('key', await sessionKey(current.token)));
          return json({ authenticated: false }, 200, { 'set-cookie': cookie('', 0) });
        }
        if (path === '/api/admin/properties') {
          if (request.method === 'GET') return json({ properties: (await catalog()).properties });
          if (request.method === 'POST') return await save(request);
          fail('invalid_input', 405);
        }
        const property = path.match(/^\/api\/admin\/properties\/([a-z0-9-]{1,100})(?:\/(uploads))?$/);
        if (property && SLUG.test(property[1])) {
          if (property[2] === 'uploads' && request.method === 'POST') return await upload(request, property[1]);
          if (!property[2] && request.method === 'PATCH') return await save(request, property[1]);
          if (!property[2] && request.method === 'DELETE') return await remove(request, property[1]);
          fail('invalid_input', 405);
        }
        const completed = path.match(/^\/api\/admin\/uploads\/([0-9a-f-]{36})\/complete$/);
        if (completed && UUID.test(completed[1]) && request.method === 'POST') { await input(request, 2048); return await complete(completed[1]); }
        fail('not_found', 404);
      } catch (error) {
        const known = error instanceof PropertyError;
        return json({ error: { code: known ? error.code : 'service_unavailable', diagnosticId } }, known ? error.status : 503);
      }
    },
  };
}
