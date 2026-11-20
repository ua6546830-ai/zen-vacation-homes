import { ChatError } from './sse-chat/handler.mjs';

const LEASE_MS = 90000;
const COLUMNS = 'key,version,token,expires_at,value';
const fail = code => { throw new ChatError(code); };
const clone = value => value == null ? null : structuredClone(value);

function rows(result) {
  if (result?.error || !Array.isArray(result?.data)) fail('service_unavailable');
  return result.data;
}

function version(value) {
  if (!/^[1-9][0-9]*$/.test(String(value))) fail('service_unavailable');
  const parsed = BigInt(value);
  if (parsed >= 9223372036854775807n) fail('service_unavailable');
  return parsed;
}

function nextVersion(value) {
  const next = version(value) + 1n;
  return next <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(next) : String(next);
}

function validRow(row) {
  if (!row || typeof row.token !== 'string' || !Number.isSafeInteger(Number(row.expires_at))
    || Number(row.expires_at) < 0) fail('service_unavailable');
  version(row.version);
  return row;
}

export function createCoordinator(db) {
  if (typeof db?.from !== 'function') fail('service_unavailable');
  const keyOf = key => {
    if (typeof key !== 'string' || !key || key.length > 300) fail('service_unavailable');
    return key;
  };
  async function load(key) {
    const found = rows(await db.from('zen_state').select(COLUMNS).eq('key', keyOf(key)).limit(1));
    return found.length ? validRow(found[0]) : null;
  }
  function fencedUpdate(key, old, update) {
    // Every mutation fences against the exact lease generation, including expiry.
    return db.from('zen_state').update(update).eq('key', key)
      .eq('version', old.version).eq('token', old.token).eq('expires_at', old.expires_at).select(COLUMNS);
  }
  async function readState(key) {
    try { return clone((await load(key))?.value); }
    catch (error) { if (error instanceof ChatError) throw error; fail('service_unavailable'); }
  }
  async function withLock(key, callback) {
    key = keyOf(key);
    if (typeof callback !== 'function') fail('service_unavailable');
    let held, closed = false, queue = Promise.resolve(), result, failure;
    try {
      rows(await db.from('zen_state').insertIfAbsent({ key, version: 1, token: '', expires_at: 0, value: null },
        { onConflict: 'key' }).select(COLUMNS));
      const old = await load(key);
      if (!old || Number(old.expires_at) > Date.now()) fail('dispatch_unknown');
      const claimed = rows(await fencedUpdate(key, old, {
        token: crypto.randomUUID(), expires_at: Date.now() + LEASE_MS, version: nextVersion(old.version),
      }));
      if (claimed.length !== 1) fail('dispatch_unknown');
      held = validRow(claimed[0]);
      const serialize = action => {
        const pending = queue.then(() => {
          if (closed) fail('dispatch_unknown');
          return action();
        });
        queue = pending.catch(() => {});
        return pending;
      };
      const assert = async () => {
        if (!held || Number(held.expires_at) <= Date.now()) fail('dispatch_unknown');
        const fresh = await load(key);
        if (!fresh || fresh.token !== held.token || String(fresh.version) !== String(held.version)
          || String(fresh.expires_at) !== String(held.expires_at) || Number(fresh.expires_at) <= Date.now()) fail('dispatch_unknown');
        return fresh;
      };
      const lease = Object.freeze({
        assertHeld: () => serialize(async () => { await assert(); }),
        read: () => serialize(async () => clone((await assert()).value)),
        write: value => serialize(async () => {
          const document = clone(value);
          const encoded = JSON.stringify(document);
          if (new TextEncoder().encode(encoded).length > 2 * 1024 * 1024) fail('service_unavailable');
          await assert();
          if (Number(held.expires_at) <= Date.now()) fail('dispatch_unknown');
          const updated = rows(await fencedUpdate(key, held, {
            value: document, version: nextVersion(held.version), expires_at: Date.now() + LEASE_MS,
          }));
          if (updated.length !== 1) fail('dispatch_unknown');
          held = validRow(updated[0]);
          return clone(held.value);
        }),
      });
      result = await callback(lease);
    } catch (error) {
      failure = error;
    } finally {
      await queue;
      closed = true;
      if (held) {
        try {
          rows(await fencedUpdate(key, held, { token: '', expires_at: 0, version: nextVersion(held.version) }));
        } catch { if (!failure) failure = new ChatError('service_unavailable'); }
      }
    }
    if (failure) {
      if (failure instanceof ChatError || failure?.name === 'CloudAgentsError') throw failure;
      fail('service_unavailable');
    }
    return result;
  }
  return Object.freeze({ withLock, readState });
}
