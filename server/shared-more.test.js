import { describe, expect, it } from "vitest";
import { clip, csvCell, guard, makeReply, notifyStaff, randomToken, sendEmail, sha256, toCsv } from "./shared.js";
import { fakeDb, jsonResponse, withFetch } from "./fake-d1.js";

const req = (headers = {}, url = "https://hgdmachines.online/api/quote") => new Request(url, { method: "POST", headers });

describe("shared helpers (more)", () => {
  it("sha256 matches the known test vector", async () => {
    expect(await sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("randomToken is hex, the right length and not repeated", () => {
    const a = randomToken(), b = randomToken();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(a).not.toBe(b);
    expect(randomToken(3)).toHaveLength(6);
  });
  it("clip trims, limits and tolerates null", () => {
    expect(clip("  hello  ", 3)).toBe("hel");
    expect(clip(null, 5)).toBe("");
  });
  it("csv quotes newlines and returns an empty string for no rows", () => {
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(toCsv([])).toBe("");
  });
});

describe("makeReply", () => {
  it("returns a bare fragment for htmx, with X-Sent only when sent", async () => {
    const reply = makeReply(req({ "HX-Request": "true" }));
    const ok = reply("ok", "Hi", true);
    expect(await ok.text()).toBe('<div class="ok">Hi</div>');
    expect(ok.headers.get("X-Sent")).toBe("1");
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(reply("err", "No").headers.get("X-Sent")).toBeNull();
    expect(reply("err", "No").status).toBe(200);
  });
  it("returns a full page when JavaScript (htmx) is off", async () => {
    const body = await makeReply(req())("ok", "Hi").text();
    expect(body).toContain("<!doctype html>");
    expect(body).toContain('<div class="ok">Hi</div>');
  });
});

describe("guard", () => {
  it("blocks cross-origin posts with 403", async () => {
    const g = await guard(req({ Origin: "https://evil.example" }), {}, "quote");
    expect(g.blocked.status).toBe(403);
  });
  it("lets same-origin posts through when there is no database", async () => {
    expect(await guard(req({ Origin: "https://hgdmachines.online" }), {}, "quote")).toEqual({ limited: false });
  });
  it("limits a visitor who reached the maximum, and does not log that attempt", async () => {
    const db = fakeDb((sql) => (sql.startsWith("SELECT COUNT") ? { n: 8 } : null));
    expect((await guard(req(), { DB: db }, "quote")).limited).toBe(true);
    expect(db.calls.some((c) => c.sql.startsWith("INSERT"))).toBe(false);
  });
  it("records an attempt under the maximum, storing only a salted hash of the IP", async () => {
    const db = fakeDb((sql) => (sql.startsWith("SELECT COUNT") ? { n: 1 } : null));
    const g = await guard(req({ "CF-Connecting-IP": "203.0.113.9" }), { DB: db, IP_SALT: "s" }, "quote");
    expect(g.limited).toBe(false);
    const insert = db.calls.find((c) => c.sql.startsWith("INSERT"));
    expect(insert.args[0]).toBe(await sha256("s:203.0.113.9"));
    expect(insert.args[0]).not.toContain("203.0.113.9");
    expect(insert.args[1]).toBe("quote");
  });
  it("fails open when the database errors", async () => {
    const db = fakeDb(() => { throw new Error("D1 down"); });
    expect((await guard(req(), { DB: db }, "quote")).limited).toBe(false);
  });
});

describe("email helpers", () => {
  const mail = { to: "a@b.co", subject: "S", html: "<p>x</p>", replyTo: "r@b.co" };
  it("sendEmail does nothing without RESEND_API_KEY and MAIL_FROM", async () => {
    const requests = await withFetch(() => jsonResponse({}), async () => { expect(await sendEmail({}, mail)).toBe(false); });
    expect(requests).toHaveLength(0);
  });
  it("sendEmail posts to Resend with the bearer key", async () => {
    const requests = await withFetch(() => jsonResponse({ id: "1" }), async () => {
      expect(await sendEmail({ RESEND_API_KEY: "k", MAIL_FROM: "Me <m@b.co>" }, mail)).toBe(true);
    });
    expect(requests[0].url).toBe("https://api.resend.com/emails");
    expect(requests[0].init.headers.Authorization).toBe("Bearer k");
    expect(requests[0].body).toMatchObject({ from: "Me <m@b.co>", to: ["a@b.co"], subject: "S", reply_to: "r@b.co" });
  });
  it("sendEmail reports failure for a non-2xx answer or a thrown error", async () => {
    await withFetch(() => new Response("no", { status: 500 }), async () => { expect(await sendEmail({ RESEND_API_KEY: "k", MAIL_FROM: "m" }, mail)).toBe(false); });
    await withFetch(() => { throw new Error("offline"); }, async () => { expect(await sendEmail({ RESEND_API_KEY: "k", MAIL_FROM: "m" }, mail)).toBe(false); });
  });
  it("notifyStaff prefers Resend, falls back to Web3Forms, and is false with neither", async () => {
    const staff = { to: "s@b.co", subject: "Subj", name: "N", email: "e@b.co", text: "<b>Hello</b>" };
    const viaResend = await withFetch(() => jsonResponse({}), async () => { await notifyStaff({ RESEND_API_KEY: "k", MAIL_FROM: "m" }, staff); });
    expect(viaResend[0].url).toContain("resend.com");
    expect(viaResend[0].body.html).toContain("&lt;b&gt;Hello&lt;/b&gt;"); // staff text is escaped
    const viaWeb3 = await withFetch(() => jsonResponse({ success: true }), async () => { expect(await notifyStaff({}, { ...staff, web3formsKey: "w" })).toBe(true); });
    expect(viaWeb3[0].url).toBe("https://api.web3forms.com/submit");
    expect(viaWeb3[0].body).toMatchObject({ access_key: "w", subject: "Subj", message: "<b>Hello</b>" });
    expect(await notifyStaff({}, staff)).toBe(false);
  });
});
