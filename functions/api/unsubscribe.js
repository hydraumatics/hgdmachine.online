// POST /api/unsubscribe: by token (link in newsletters) or by email address. Always answers the same way.
import { EMAIL_RE, clip, guard, makeReply } from "../../server/shared.js";

export async function onRequestPost({ request, env }) {
  const reply = makeReply(request);
  const g = await guard(request, env, "unsubscribe", { max: 10 });
  if (g.blocked) return g.blocked;
  let f;
  try { f = await request.formData(); } catch { return reply("err", "Something went wrong. Please try again."); }
  const token = clip(f.get("token"), 100), email = clip(f.get("email"), 160).toLowerCase();
  if (!token && !EMAIL_RE.test(email)) return reply("err", "Please enter the email address you subscribed with.");
  try {
    if (env.DB) {
      const sql = "UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now'), confirm_token = NULL WHERE status != 'unsubscribed' AND ";
      await (token ? env.DB.prepare(sql + "unsub_token = ?1").bind(token) : env.DB.prepare(sql + "email = ?1").bind(email)).run();
    }
  } catch (e) { console.log("Unsubscribe error:", String(e)); return reply("err", "We could not process that just now. Please email <a href='mailto:news@hgdmachines.online'>news@hgdmachines.online</a>."); }
  return reply("ok", "Done. If that address was subscribed, it has been removed from the newsletter.", true);
}
export const onRequest = () => new Response("Method not allowed", { status: 405 });
