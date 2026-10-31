// Cloudflare Pages Function: POST /api/quote  (returns HTML for htmx)
// One env var needed: WEB3FORMS_KEY
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const clip = (s, n) => String(s ?? "").trim().slice(0, n);
const msg = (cls, text) => `<div class="${cls}">${text}</div>`;

export async function onRequestPost({ request, env }) {
  const isHtmx = request.headers.get("HX-Request") === "true";
  const reply = (cls, text, sent = false) => {
    const body = isHtmx ? msg(cls, text) : `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem">${msg(cls, text)}<p><a href="/">Back to the site</a></p>`;
    return new Response(body, { headers: { "content-type": "text/html; charset=utf-8", ...(sent ? { "X-Sent": "1" } : {}) } }); // always 200 so htmx swaps it in
  };
  let f; try { f = await request.formData(); } catch { return reply("err", "Something went wrong. Please try again."); }
  const d = { name:clip(f.get("name"),120), company:clip(f.get("company"),160), email:clip(f.get("email"),160), phone:clip(f.get("phone"),40),
              details:clip(f.get("details"),5000), delivery:clip(f.get("delivery"),60), urgency:clip(f.get("urgency"),60) };
  const ref = "HYD-" + new Date().toISOString().slice(2,10).replace(/-/g,"") + "-" + Math.random().toString(36).slice(2,6).toUpperCase();
  if (f.get("website")) return reply("ok", `Thank you. Your request reference is <b>${ref}</b>.`, true); // honeypot
  if (!d.name || !d.company || !d.details || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email) || f.get("consent") !== "yes")
    return reply("err", "Please complete all required fields, use a valid email address and tick the privacy box.");
  if (!env.WEB3FORMS_KEY) return reply("err", "The form is not connected yet. Please email <a href='mailto:procurement@hydraumatics.zm'>procurement@hydraumatics.zm</a>.");
  const message = [`Reference: ${ref}`,`Name and title: ${d.name}`,`Company or site: ${d.company}`,`Email: ${d.email}`,`Phone: ${d.phone||"-"}`,`Delivery terms: ${d.delivery}`,`Urgency: ${d.urgency}`,"Consent: given (Privacy Notice)","","Requirement:",d.details].join("\n");
  try {
    const r = await fetch("https://api.web3forms.com/submit", { method:"POST", headers:{ "content-type":"application/json", accept:"application/json" },
      body: JSON.stringify({ access_key: env.WEB3FORMS_KEY, subject: `${d.urgency.startsWith("Urgent") ? "[URGENT] " : ""}Quote request ${ref}: ${d.company}`, from_name:"Hydraumatics website", name:d.name, email:d.email, message }) });
    const j = await r.json().catch(() => ({}));
    if (j.success) return reply("ok", `Thank you, ${esc(d.name)}. Your request reference is <b>${ref}</b>. We will reply by email shortly.`, true);
    console.log("Web3Forms error:", r.status, JSON.stringify(j));
  } catch (e) { console.log("Web3Forms fetch failed:", String(e)); }
  return reply("err", "We could not send your request. Please email <a href='mailto:procurement@hydraumatics.zm'>procurement@hydraumatics.zm</a>.");
}
export const onRequest = () => new Response("Method not allowed", { status: 405 });
