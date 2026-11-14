// Minimal stand-in for a Cloudflare D1 binding, for unit tests.
// `handler(sql, args, method)` decides what each query returns; every call is recorded in `calls`.
export function fakeDb(handler = () => null) {
  const calls = [];
  const db = {
    calls,
    prepare(sql) {
      const stmt = {
        args: [],
        bind(...args) { stmt.args = args; return stmt; },
        async first() { calls.push({ sql, args: stmt.args, method: "first" }); return handler(sql, stmt.args, "first") ?? null; },
        async run() { calls.push({ sql, args: stmt.args, method: "run" }); return handler(sql, stmt.args, "run") ?? { success: true }; },
        async all() { calls.push({ sql, args: stmt.args, method: "all" }); return handler(sql, stmt.args, "all") ?? { results: [] }; },
      };
      return stmt;
    },
  };
  return db;
}

/** Runs fn with global fetch replaced; returns the recorded requests. */
export async function withFetch(respond, fn) {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : undefined });
    return respond(String(url), init);
  };
  try { await fn(requests); } finally { globalThis.fetch = original; }
  return requests;
}
export const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
