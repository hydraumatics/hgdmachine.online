// POST /api/quote: stores the customer + request in D1, emails the team, optionally acknowledges the customer.
// Env: DB (D1 binding), WEB3FORMS_KEY or RESEND_API_KEY+MAIL_FROM, optional STAFF_EMAIL, IP_SALT
import { EMAIL_RE, clip, esc, guard, makeRef, makeReply, nowIso, notifyStaff, sendEmail } from "../../server/shared.js";

const UPSERT_CONTACT = `INSERT INTO contacts (email, name, company, phone) VALUES (?1, ?2, ?3, ?4)
  ON CONFLICT(email) DO UPDATE SET name = excluded.name, company = excluded.company,
    phone = COALESCE(NULLIF(excluded.phone, ''), contacts.phone), updated_at = datetime('now')
  RETURNING id`;

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const reply = makeReply(request);
  const g = await guard(request, env, "quote");
  if (g.blocked) return g.blocked;
  if (g.limited) return reply("err", "Too many requests from your connection. Please try again later, or email <a href='mailto:procurement@hgdmachines.online'>procurement@hgdmachines.online</a>.");

  let f;
  try { f = await request.formData(); } catch { return reply("err", "Something went wrong. Please try again."); }
  const ref = makeRef();
  if (f.get("website")) return reply("ok", `Thank you. Your request reference is <b>${ref}</b>.`, true); // honeypot

  const d = { name: clip(f.get("name"), 120), company: clip(f.get("company"), 160), email: clip(f.get("email"), 160).toLowerCase(), phone: clip(f.get("phone"), 40),
    details: clip(f.get("details"), 5000), delivery: clip(f.get("delivery"), 60), urgency: clip(f.get("urgency"), 60) };
  if (!d.name || !d.company || !d.details || !EMAIL_RE.test(d.email) || f.get("consent") !== "yes")
    return reply("err", "Please complete all required fields, use a valid email address and tick the privacy box.");

  let stored = false;
  if (env.DB) {
    try {
      const c = await env.DB.prepare(UPSERT_CONTACT).bind(d.email, d.name, d.company, d.phone).first();
      await env.DB.prepare("INSERT INTO quote_requests (ref, contact_id, details, delivery, urgency, consent_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
        .bind(ref, c.id, d.details, d.delivery, d.urgency, nowIso()).run();
      stored = true;
    } catch (e) { console.log("D1 write failed:", String(e)); }
  }

  const text = [`Reference: ${ref}`, `Name and title: ${d.name}`, `Company or site: ${d.company}`, `Email: ${d.email}`, `Phone: ${d.phone || "-"}`,
    `Delivery terms: ${d.delivery}`, `Urgency: ${d.urgency}`, "Consent: given (Privacy notice)", "", "Requirement:", d.details].join("\n");
  const notified = await notifyStaff(env, { to: env.STAFF_EMAIL || "procurement@hgdmachines.online", replyTo: d.email, name: d.name, email: d.email, web3formsKey: env.WEB3FORMS_KEY,
    subject: `${d.urgency.startsWith("Urgent") ? "[URGENT] " : ""}Quote request ${ref}: ${d.company}`, text });

  if (!stored && !notified) return reply("err", "We could not send your request. Please email <a href='mailto:procurement@hgdmachines.online'>procurement@hgdmachines.online</a>.");
  if (!stored) console.log(`Quote ${ref} was emailed but NOT stored: check the D1 binding`);

  ctx.waitUntil(sendEmail(env, { to: d.email, replyTo: "procurement@hgdmachines.online", subject: `We received your request ${ref}`,
    html: `<p>Hello ${esc(d.name)},</p><p>Thank you for contacting Hydraumatics General Dealers. We received your request (reference <b>${ref}</b>) and will reply by email, usually within one working day.</p><p>This is an automatic acknowledgement, not a quotation or order confirmation.</p>` }));
  return reply("ok", `Thank you, ${esc(d.name)}. Your request reference is <b>${ref}</b>. We will reply by email shortly.`, true);
}
export const onRequest = () => new Response("Method not allowed", { status: 405 });
