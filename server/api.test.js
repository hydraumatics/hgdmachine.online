// Tests for the Cloudflare Pages Functions in /functions/api (they live here so they never become public routes).
import { describe, expect, it } from "vitest";
import { onRequest as quoteOther, onRequestPost as quote } from "../functions/api/quote.js";
import { onRequestPost as newsletter } from "../functions/api/newsletter.js";
import { onRequestGet as confirm } from "../functions/api/newsletter/confirm.js";
import { onRequestPost as unsubscribe } from "../functions/api/unsubscribe.js";
import { onRequestGet as exportCsv } from "../functions/api/admin/export.js";
import { fakeDb, jsonResponse, withFetch } from "./fake-d1.js";

const ORIGIN = "https://hgdmachines.online";
const post = (path, fields, headers = {}) =>
  new Request(`${ORIGIN}${path}`, { method: "POST", headers: { "HX-Request": "true", ...headers }, body: new URLSearchParams(fields) });
const context = (request, env = {}) => { const pending = []; return { request, env, pending, waitUntil: (p) => pending.push(p) }; };
const settle = (ctx) => Promise.all(ctx.pending);

const validQuote = { name: "Ada Mwansa, Procurement", company: "Test Mine", email: "Ada@Mine.co.zm", phone: "+260 97 000 0000", details: "2 x hydraulic pump, Komatsu PC400", delivery: "CIF Ndola", urgency: "Standard", consent: "yes" };
const quoteDb = () => fakeDb((sql, _a, method) => (method === "first" && sql.includes("INTO contacts") ? { id: 7 } : null));

describe("POST /api/quote", () => {
  it("answers a honeypot hit with a fake success and touches nothing", async () => {
    const db = quoteDb();
    const res = await quote(context(post("/api/quote", { ...validQuote, website: "http://spam.example" }), { DB: db }));
    expect(await res.text()).toMatch(/HYD-\d{6}-[0-9A-F]{6}/);
    expect(db.calls.filter((c) => !c.sql.startsWith("SELECT COUNT") && !c.sql.startsWith("INSERT INTO rate_limits") && !c.sql.startsWith("DELETE"))).toHaveLength(0);
  });
  it("rejects a missing consent box, a bad email and missing fields without writing", async () => {
    for (const bad of [{ consent: "" }, { email: "nope" }, { details: "" }, { company: "" }, { name: "" }]) {
      const db = quoteDb();
      const res = await quote(context(post("/api/quote", { ...validQuote, ...bad }), { DB: db }));
      expect(await res.text()).toContain('class="err"');
      expect(db.calls.some((c) => c.sql.includes("quote_requests"))).toBe(false);
    }
  });
  it("blocks cross-origin submissions", async () => {
    const res = await quote(context(post("/api/quote", validQuote, { Origin: "https://evil.example" })));
    expect(res.status).toBe(403);
  });
  it("stores contact and request, lower-cases the email and confirms with a reference", async () => {
    const db = quoteDb();
    const ctx = context(post("/api/quote", validQuote), { DB: db });
    const res = await quote(ctx);
    const body = await res.text();
    expect(res.headers.get("X-Sent")).toBe("1");
    expect(body).toContain("Thank you, Ada Mwansa, Procurement.");
    const ref = body.match(/HYD-\d{6}-[0-9A-F]{6}/)[0];
    const contact = db.calls.find((c) => c.sql.includes("INTO contacts"));
    expect(contact.args.slice(0, 2)).toEqual(["ada@mine.co.zm", "Ada Mwansa, Procurement"]);
    const insert = db.calls.find((c) => c.sql.includes("INTO quote_requests"));
    expect(insert.args.slice(0, 2)).toEqual([ref, 7]);
    await settle(ctx);
  });
  it("escapes HTML in the visitor's name", async () => {
    const res = await quote(context(post("/api/quote", { ...validQuote, name: "<img src=x onerror=alert(1)>" }), { DB: quoteDb() }));
    const body = await res.text();
    expect(body).not.toContain("<img");
    expect(body).toContain("&lt;img");
  });
  it("says so when the request could neither be stored nor emailed", async () => {
    const res = await quote(context(post("/api/quote", validQuote), {}));
    expect(await res.text()).toContain("could not send your request");
  });
  it("still succeeds when only email works, and marks urgent requests", async () => {
    const requests = await withFetch(() => jsonResponse({ success: true }), async () => {
      const ctx = context(post("/api/quote", { ...validQuote, urgency: "Urgent: machine down" }), { WEB3FORMS_KEY: "w" });
      const res = await quote(ctx);
      expect(await res.text()).toContain("Your request reference is");
      await settle(ctx);
    });
    const staff = requests.find((r) => r.url.includes("web3forms"));
    expect(staff.body.subject).toMatch(/^\[URGENT\] Quote request HYD-/);
    expect(staff.body.message).toContain("Test Mine");
  });
  it("falls back to email when the database write fails", async () => {
    const db = fakeDb((sql) => { if (sql.includes("INTO contacts")) throw new Error("D1 down"); return null; });
    await withFetch(() => jsonResponse({ success: true }), async () => {
      const res = await quote(context(post("/api/quote", validQuote), { DB: db, WEB3FORMS_KEY: "w" }));
      expect(await res.text()).toContain('class="ok"');
    });
  });
  it("sends the customer an acknowledgement through Resend when configured", async () => {
    const requests = await withFetch(() => jsonResponse({ id: "1" }), async () => {
      const ctx = context(post("/api/quote", validQuote), { DB: quoteDb(), RESEND_API_KEY: "k", MAIL_FROM: "Shop <n@hgdmachines.online>" });
      await quote(ctx);
      await settle(ctx);
    });
    const tos = requests.map((r) => r.body.to[0]);
    expect(tos).toContain("procurement@hgdmachines.online");
    expect(tos).toContain("ada@mine.co.zm");
    const customer = requests.find((r) => r.body.to[0] === "ada@mine.co.zm").body;
    expect(customer.subject).toMatch(/^We have received your request HYD-/);
    expect(customer.html).toContain("What happens next");
    expect(customer.text).toContain("Hello Ada Mwansa,");
    expect(customer.reply_to).toBe("procurement@hgdmachines.online");
  });
  it("rejects other methods with 405", () => expect(quoteOther().status).toBe(405));
});

describe("POST /api/newsletter", () => {
  const valid = { email: "Buyer@Example.com", name: "Bo", consent: "yes" };
  const upsertDb = (status) => fakeDb((sql, _a, method) => (method === "first" && sql.includes("newsletter_subscribers") ? { status, confirm_token: "tok123" } : null));
  const upsert = (db) => db.calls.find((c) => c.sql.includes("INTO newsletter_subscribers"));

  it("needs a valid email and the consent box", async () => {
    for (const bad of [{ consent: "" }, { email: "nope" }]) {
      const db = upsertDb("subscribed");
      expect(await (await newsletter(context(post("/api/newsletter", { ...valid, ...bad }), { DB: db }))).text()).toContain('class="err"');
      expect(upsert(db)).toBeUndefined();
    }
  });
  it("reports a missing database and a missing email channel instead of pretending to subscribe", async () => {
    expect(await (await newsletter(context(post("/api/newsletter", valid), {}))).text()).toContain("could not sign you up");
  });
  it("without a database, still passes the signup to the team by email", async () => {
    const requests = await withFetch(() => jsonResponse({ success: true }), async () => {
      const res = await newsletter(context(post("/api/newsletter", valid), { WEB3FORMS_KEY: "w" }));
      const body = await res.text();
      expect(body).toContain("We have your sign-up");
      expect(res.headers.get("X-Sent")).toBe("1");
    });
    expect(requests[0].body.subject).toContain("not stored");
    expect(requests[0].body.message).toContain("buyer@example.com");
  });
  it("without a database and when the email also fails, shows the error", async () => {
    await withFetch(() => jsonResponse({ success: false }), async () => {
      expect(await (await newsletter(context(post("/api/newsletter", valid), { WEB3FORMS_KEY: "w" }))).text()).toContain("could not sign you up");
    });
  });
  it("keeps only known interests and stores the consent proof (single opt-in)", async () => {
    const db = upsertDb("subscribed");
    const ctx = context(post("/api/newsletter", [["email", valid.email], ["consent", "yes"], ["interest", "Spare parts"], ["interest", "Bitcoin"], ["interest", "Safety supplies"]]), { DB: db });
    const body = await (await newsletter(ctx)).text();
    expect(body).toContain("You are on the list");
    const [email, , interests, status, consentText] = upsert(db).args;
    expect(email).toBe("buyer@example.com");
    expect(interests).toBe("Spare parts, Safety supplies");
    expect(status).toBe("subscribed");
    expect(consentText).toContain("Consent given on");
    await settle(ctx);
  });
  it("uses double opt-in when Resend is configured and mails a confirmation link", async () => {
    const db = upsertDb("pending");
    const requests = await withFetch(() => jsonResponse({ id: "1" }), async () => {
      const ctx = context(post("/api/newsletter", valid), { DB: db, RESEND_API_KEY: "k", MAIL_FROM: "n@hgdmachines.online" });
      expect(await (await newsletter(ctx)).text()).toContain("check your inbox");
      await settle(ctx);
    });
    expect(upsert(db).args[3]).toBe("pending");
    expect(requests[0].body.html).toContain(`${ORIGIN}/api/newsletter/confirm?t=tok123`);
  });
  it("tells the user when the database fails", async () => {
    const db = fakeDb(() => { throw new Error("D1 down"); });
    expect(await (await newsletter(context(post("/api/newsletter", valid), { DB: db }))).text()).toContain("could not sign you up");
  });
  it("honeypot gets a fake thank-you and no database write", async () => {
    const db = upsertDb("subscribed");
    const res = await newsletter(context(post("/api/newsletter", { ...valid, website: "x" }), { DB: db }));
    expect(await res.text()).toContain("Thank you for subscribing");
    expect(upsert(db)).toBeUndefined();
  });
});

describe("GET /api/newsletter/confirm", () => {
  const get = (t, db) => confirm({ request: new Request(`${ORIGIN}/api/newsletter/confirm?t=${t}`), env: db ? { DB: db } : {} });
  it("rejects missing, short or database-less tokens without querying", async () => {
    const db = fakeDb();
    expect(await (await get("short", db)).text()).toContain("Link not valid");
    expect(db.calls).toHaveLength(0);
    expect(await (await get("x".repeat(30))).text()).toContain("Link not valid");
  });
  it("confirms a pending subscription", async () => {
    const db = fakeDb(() => ({ email: "buyer@example.com" }));
    expect(await (await get("t".repeat(30), db)).text()).toContain("Subscription confirmed");
    expect(db.calls[0].args).toEqual(["t".repeat(30)]);
  });
  it("says an already used token is not valid", async () => {
    expect(await (await get("t".repeat(30), fakeDb(() => null))).text()).toContain("already been used");
  });
});

describe("POST /api/unsubscribe", () => {
  const run = (fields, env) => unsubscribe({ request: post("/api/unsubscribe", fields), env });
  it("needs a token or a valid email", async () => {
    expect(await (await run({}, {})).text()).toContain('class="err"');
    expect(await (await run({ email: "nope" }, {})).text()).toContain('class="err"');
  });
  it("unsubscribes by email or by token and always answers the same way", async () => {
    const byEmail = fakeDb();
    const a = await (await run({ email: "Buyer@Example.com" }, { DB: byEmail })).text();
    expect(byEmail.calls.find((c) => c.sql.includes("email = ?1")).args).toEqual(["buyer@example.com"]);
    const byToken = fakeDb();
    const b = await (await run({ token: "abc" }, { DB: byToken })).text();
    expect(byToken.calls.find((c) => c.sql.includes("unsub_token = ?1")).args).toEqual(["abc"]);
    const c = await (await run({ email: "x@y.co" }, {})).text();
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toContain("If that address was subscribed");
  });
  it("reports a database error", async () => {
    const db = fakeDb(() => { throw new Error("D1 down"); });
    expect(await (await run({ email: "x@y.co" }, { DB: db })).text()).toContain("could not process");
  });
});

describe("GET /api/admin/export", () => {
  const rows = [{ email: "a@b.co", name: "=cmd()", status: "subscribed" }];
  const db = () => fakeDb((_s, _a, method) => (method === "all" ? { results: rows } : null));
  const get = (query, token, env) =>
    exportCsv({ request: new Request(`${ORIGIN}/api/admin/export${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }), env });

  it("is hidden (404) until ADMIN_TOKEN and the database are configured", async () => {
    expect((await get("?table=quotes", "t", { DB: db() })).status).toBe(404);
    expect((await get("?table=quotes", "t", { ADMIN_TOKEN: "t" })).status).toBe(404);
  });
  it("requires the right bearer token", async () => {
    expect((await get("?table=quotes", "", { ADMIN_TOKEN: "secret", DB: db() })).status).toBe(401);
    const bad = await get("?table=quotes", "wrong", { ADMIN_TOKEN: "secret", DB: db() });
    expect(bad.status).toBe(401);
    expect(bad.headers.get("WWW-Authenticate")).toBe("Bearer");
  });
  it("rejects unknown tables", async () => {
    expect((await get("?table=users", "secret", { ADMIN_TOKEN: "secret", DB: db() })).status).toBe(400);
    expect((await get("", "secret", { ADMIN_TOKEN: "secret", DB: db() })).status).toBe(400);
  });
  it("returns a CSV download with formula injection neutralised", async () => {
    const res = await get("?table=subscribers&status=subscribed", "secret", { ADMIN_TOKEN: "secret", DB: db() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain('filename="subscribers.csv"');
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("email,name,status\na@b.co,'=cmd(),subscribed");
  });
  it("filters subscribers by status", async () => {
    const d = db();
    await get("?table=subscribers&status=pending", "secret", { ADMIN_TOKEN: "secret", DB: d });
    expect(d.calls[0].args).toEqual(["pending"]);
  });
});
