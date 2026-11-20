export function createMemoryDatabase() {
  const tables = new Map();
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.mode = 'read'; this.columns = '*'; this.maximum = Infinity; }
    select(columns = '*') { this.columns = columns; return this; }
    eq(key, value) { this.filters.push(row => row[key] === value); return this; }
    neq(key, value) { this.filters.push(row => row[key] !== value); return this; }
    lt(key, value) { this.filters.push(row => row[key] < value); return this; }
    lte(key, value) { this.filters.push(row => row[key] <= value); return this; }
    gt(key, value) { this.filters.push(row => row[key] > value); return this; }
    gte(key, value) { this.filters.push(row => row[key] >= value); return this; }
    is(key, value) { this.filters.push(row => row[key] === value); return this; }
    limit(value) { this.maximum = value; return this; }
    order(key, { ascending = true } = {}) { this.sort = { key, ascending }; return this; }
    insert(value) { this.mode = 'insert'; this.values = Array.isArray(value) ? value : [value]; return this; }
    insertIfAbsent(value, { onConflict = 'key' } = {}) { this.insert(value); this.mode = 'insertIfAbsent'; this.conflict = onConflict.split(','); return this; }
    update(value) { this.mode = 'update'; this.patch = value; return this; }
    delete() { this.mode = 'delete'; return this; }
    then(resolve, reject) { return Promise.resolve().then(() => this.execute()).then(resolve, reject); }
    execute() {
      const table = tables.get(this.table) ?? [];
      tables.set(this.table, table);
      let affected = [];
      if (this.mode === 'insert' || this.mode === 'insertIfAbsent') {
        for (const value of this.values) {
          const duplicate = table.find(row => (this.conflict ?? ['key']).every(key => row[key] === value[key]));
          if (duplicate) {
            if (this.mode === 'insert') return { data: [], error: { code: 'duplicate_key', status: 409 } };
            continue;
          }
          const row = structuredClone(value); table.push(row); affected.push(row);
        }
      } else {
        affected = table.filter(row => this.filters.every(filter => filter(row)));
        if (this.sort) {
          const { key, ascending } = this.sort;
          affected.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1));
        }
        affected = affected.slice(0, this.maximum);
        if (this.mode === 'update') for (const row of affected) Object.assign(row, structuredClone(this.patch));
        if (this.mode === 'delete') for (const row of affected) table.splice(table.indexOf(row), 1);
      }
      const columns = this.columns.split(',').map(column => column.trim());
      return { data: structuredClone(affected.map(row => columns.includes('*') ? row : Object.fromEntries(columns.map(column => [column, row[column]])))), error: null };
    }
  }
  return { from: table => new Query(table), tables };
}

export function createMemoryStorage() {
  const files = new Map();
  return {
    files,
    async createSignedUploadUrl(path) { return { signedUrl: `/__local_upload/${path.split('/').map(encodeURIComponent).join('/')}` }; },
    async download(path) {
      const file = files.get(path);
      if (!file) { const error = new Error('missing'); error.code = 'storage_object_not_found'; throw error; }
      return new Response(file.bytes.slice(), { headers: { 'content-type': file.type } });
    },
    async remove(paths) { for (const path of paths) files.delete(path); return {}; },
  };
}
