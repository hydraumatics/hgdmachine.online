// GET /api/newsletter/confirm?t=TOKEN : completes double opt-in.
import { esc } from "../../../server/shared.js";

const page = (title, msg) => new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem"><h1>${esc(title)}</h1><p>${esc(msg)}</p><p><a href="/">Back to the site</a></p></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export async function onRequestGet({ request, env }) {
  const t = new URL(request.url).searchParams.get("t") || "";
  if (!env.DB || t.length < 20) return page("Link not valid", "This confirmation link is not valid or has expired.");
  const row = await env.DB.prepare("UPDATE newsletter_subscribers SET status = 'subscribed', confirmed_at = datetime('now'), confirm_token = NULL WHERE confirm_token = ?1 AND status = 'pending' RETURNING email").bind(t).first();
  return row ? page("Subscription confirmed", "Thank you. You are now subscribed to the Hydraumatics General Dealers newsletter.") : page("Link not valid", "This confirmation link is not valid or has already been used.");
}
