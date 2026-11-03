// POST /api/newsletter: stores the subscriber and the proof of consent in D1.
// With RESEND_API_KEY + MAIL_FROM: double opt-in (confirmation email). Without: single opt-in, and the team is notified.
import { EMAIL_RE, clip, esc, guard, makeReply, nowIso, notifyStaff, randomToken, sendEmail } from "../../server/shared.js";

const INTERESTS = ["Hydraulics and drivetrain", "Heavy machinery", "Spare parts", "Consumables", "Power and solar", "Safety supplies"];
const UPSERT = `INSERT INTO newsletter_subscribers (email, name, interests, status, consent_text, consent_at, confirm_token, unsub_token, confirmed_at)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
  ON CONFLICT(email) DO UPDATE SET
    name = excluded.name, interests = excluded.interests,
    status = CASE WHEN newsletter_subscribers.status = 'subscribed' THEN 'subscribed' ELSE excluded.status END,
    consent_text = excluded.consent_text, consent_at = excluded.consent_at,
    confirm_token = CASE WHEN newsletter_subscribers.status = 'subscribed' THEN newsletter_subscribers.confirm_token ELSE excluded.confirm_token END,
    confirmed_at = CASE WHEN newsletter_subscribers.status = 'subscribed' THEN newsletter_subscribers.confirmed_at ELSE excluded.confirmed_at END,
    unsubscribed_at = CASE WHEN newsletter_subscribers.status = 'subscribed' THEN newsletter_subscribers.unsubscribed_at ELSE NULL END
  RETURNING status, confirm_token`;

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const reply = makeReply(request);
  const g = await guard(request, env, "newsletter", { max: 5 });
  if (g.blocked) return g.blocked;
  if (g.limited) return reply("err", "Too many attempts from your connection. Please try again later.");
  let f;
  try { f = await request.formData(); } catch { return reply("err", "Something went wrong. Please try again."); }
  if (f.get("website")) return reply("ok", "Thank you for subscribing.", true); // honeypot

  const email = clip(f.get("email"), 160).toLowerCase(), name = clip(f.get("name"), 120);
  const interests = f.getAll("interest").map((x) => clip(x, 60)).filter((x) => INTERESTS.includes(x));
  if (!EMAIL_RE.test(email) || f.get("consent") !== "yes") return reply("err", "Please enter a valid email address and tick the box to give your consent.");
  if (!env.DB) { console.log("Newsletter: D1 binding DB is missing"); return reply("err", "We could not sign you up just now. Please email <a href='mailto:news@hgdmachines.online'>news@hgdmachines.online</a>."); }

  const doubleOptIn = Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
  const now = nowIso();
  const consent = `Consent given on ${now} to: "Send me the Hydraumatics General Dealers newsletter" (Newsletter terms and Privacy notice).`;
  const confirmToken = randomToken();
  try {
    const row = await env.DB.prepare(UPSERT).bind(email, name, interests.join(", "), doubleOptIn ? "pending" : "subscribed", consent, now, doubleOptIn ? confirmToken : null, randomToken(), doubleOptIn ? null : now).first();
    const origin = new URL(request.url).origin;
    if (doubleOptIn && row.status === "pending") {
      ctx.waitUntil(sendEmail(env, { to: email, subject: "Please confirm your subscription", replyTo: "news@hgdmachines.online",
        html: `<p>Hello${name ? " " + esc(name) : ""},</p><p>Please confirm that you want to receive the Hydraumatics General Dealers newsletter:</p><p><a href="${origin}/api/newsletter/confirm?t=${row.confirm_token}">Confirm my subscription</a></p><p>If you did not ask for this, ignore this email and you will not be subscribed.</p>` }));
      return reply("ok", "Thank you. Please check your inbox and confirm your subscription.", true);
    }
    if (!doubleOptIn) ctx.waitUntil(notifyStaff(env, { to: "news@hgdmachines.online", subject: "Newsletter signup", name: name || "Subscriber", email, web3formsKey: env.NEWSLETTER_WEB3FORMS_KEY || env.WEB3FORMS_KEY, text: [`Email: ${email}`, `Name: ${name || "-"}`, `Interests: ${interests.join(", ") || "-"}`, consent].join("\n") }));
    return reply("ok", `Thank you${name ? ", " + esc(name) : ""}. You are on the list. You can unsubscribe at any time at hgdmachines.online/unsubscribe.`, true);
  } catch (e) {
    console.log("Newsletter D1 error:", String(e));
    return reply("err", "We could not sign you up just now. Please email <a href='mailto:news@hgdmachines.online'>news@hgdmachines.online</a>.");
  }
}
export const onRequest = () => new Response("Method not allowed", { status: 405 });
