// Shared helpers for the Cloudflare Pages Functions (quote, newsletter, unsubscribe, export).
// Lives outside /functions so it does not become a public route.

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const clip = (s, n) => String(s ?? "").trim().slice(0, n);
export const nowIso = () => new Date().toISOString();

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function randomToken(bytes = 24) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function makeRef(prefix = "HYD") {
  const day = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `${prefix}-${day}-${randomToken(3).toUpperCase()}`;
}
/** Constant-time comparison (hashes both sides first so lengths never leak). */
export async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/** Replies with an HTML fragment for htmx, or a tiny full page when JavaScript is off. Always HTTP 200 so htmx swaps it in. */
export function makeReply(request) {
  const htmx = request.headers.get("HX-Request") === "true";
  return (cls, text, sent = false) => {
    const frag = `<div class="${cls}">${text}</div>`;
    const body = htmx ? frag : `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hydraumatics General Dealers</title><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem">${frag}<p><a href="/">Back to the site</a></p></body></html>`;
    return new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...(sent ? { "X-Sent": "1" } : {}) } });
  };
}

/** Same-origin check + per-visitor rate limit (D1). Returns { blocked?: Response, limited: boolean }. */
export async function guard(request, env, route, { max = 8, windowSec = 3600 } = {}) {
  const origin = request.headers.get("Origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return { blocked: new Response("Forbidden", { status: 403 }), limited: false };
  if (!env.DB) return { limited: false };
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const hash = await sha256(`${env.IP_SALT || "hyd"}:${ip}`);
    const now = Math.floor(Date.now() / 1000);
    if (Math.random() < 0.05) await env.DB.prepare("DELETE FROM rate_limits WHERE ts < ?1").bind(now - 86400).run();
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE ip_hash = ?1 AND route = ?2 AND ts > ?3").bind(hash, route, now - windowSec).first();
    if (row && row.n >= max) return { limited: true };
    await env.DB.prepare("INSERT INTO rate_limits (ip_hash, route, ts) VALUES (?1, ?2, ?3)").bind(hash, route, now).run();
  } catch (e) {
    console.log("rate limit skipped:", String(e));
  }
  return { limited: false };
}

/** Optional transactional email through Resend (needs RESEND_API_KEY and MAIL_FROM on a verified domain). */
export async function sendEmail(env, { to, subject, html, replyTo }) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!r.ok) console.log("Resend error", r.status, await r.text().catch(() => ""));
    return r.ok;
  } catch (e) {
    console.log("Resend failed:", String(e));
    return false;
  }
}

/** Tell the team about a submission: Resend when configured, otherwise Web3Forms (delivers to the inbox the key belongs to). */
export async function notifyStaff(env, { to, subject, replyTo, name, email, text, web3formsKey }) {
  if (env.RESEND_API_KEY && env.MAIL_FROM) return sendEmail(env, { to, subject, replyTo, html: `<pre style="font:14px/1.5 system-ui,sans-serif;white-space:pre-wrap">${esc(text)}</pre>` });
  if (!web3formsKey) return false;
  try {
    const r = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ access_key: web3formsKey, subject, from_name: "Hydraumatics website", name, email, message: text }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.success) console.log("Web3Forms error", r.status, JSON.stringify(j));
    return Boolean(j.success);
  } catch (e) {
    console.log("Web3Forms failed:", String(e));
    return false;
  }
}

export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");
}
