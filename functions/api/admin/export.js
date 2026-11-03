// GET /api/admin/export?table=quotes|contacts|subscribers[&status=subscribed]
// Header: Authorization: Bearer <ADMIN_TOKEN>. Returns CSV. Disabled (404) until ADMIN_TOKEN is set.
import { safeEqual, toCsv } from "../../../server/shared.js";

const QUERIES = {
  quotes: "SELECT q.ref, q.status, q.created_at, c.email, c.name, c.company, c.phone, q.delivery, q.urgency, q.details FROM quote_requests q JOIN contacts c ON c.id = q.contact_id ORDER BY q.id DESC LIMIT 5000",
  contacts: "SELECT email, name, company, phone, created_at, updated_at FROM contacts ORDER BY id DESC LIMIT 5000",
  subscribers: "SELECT email, name, interests, status, consent_at, confirmed_at, unsubscribed_at, unsub_token FROM newsletter_subscribers WHERE (?1 = '' OR status = ?1) ORDER BY id DESC LIMIT 5000",
};

export async function onRequestGet({ request, env }) {
  if (!env.ADMIN_TOKEN || !env.DB) return new Response("Not found", { status: 404 });
  const auth = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!(await safeEqual(auth, env.ADMIN_TOKEN))) return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  const url = new URL(request.url), table = url.searchParams.get("table") || "";
  if (!QUERIES[table]) return new Response("Use ?table=quotes, contacts or subscribers", { status: 400 });
  const stmt = env.DB.prepare(QUERIES[table]);
  const { results } = await (table === "subscribers" ? stmt.bind(url.searchParams.get("status") || "") : stmt).all();
  return new Response(toCsv(results), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${table}.csv"`, "cache-control": "no-store" } });
}
