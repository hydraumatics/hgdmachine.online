# Hydraumatics store (Astro 7 + Starwind UI + Shopify)

Static site on Cloudflare Pages. Products and cart come from Shopify's Storefront API; **checkout is Shopify's**.

## Stack
- Astro 7, TypeScript (strict), Tailwind CSS 4
- Starwind UI components (copied into `src/components/starwind`, MIT, yours to edit). Dialogs and sheets use native `<dialog>`.
- astro-seo, @astrojs/sitemap, Astro ClientRouter (page transitions)
- htmx (bundled locally, no CDN) + Cloudflare Pages Functions: `functions/api/quote.js` (quote form, Web3Forms) and `functions/api/newsletter.js` (Buttondown, or Web3Forms fallback)
- Brand fonts (Big Shoulders, Work Sans, Crimson Pro, IBM Plex Mono: all free, OFL) and htmx are self-hosted: no third-party requests at runtime except Shopify. Colours and type roles are documented in the brand kit (brand-kit/pdf/Hydraumatics-Brand-Guidelines.pdf); machine-readable tokens are in brand/tokens.json
- Vitest (unit), Playwright + axe (end-to-end, accessibility, 5 browsers/devices)

## Start
    nvm use                       # Node 22 (see .nvmrc)
    npm install
    cp .env.example .env          # add your Shopify values, or set PUBLIC_SHOPIFY_DOMAIN=mock to use sample products
    npm run dev                   # http://localhost:4321

## Quality gates (also run in CI: .github/workflows/ci.yml)
    npm run check                 # Astro + TypeScript type check
    npm test                      # unit tests (src/lib/utils.test.ts)
    npm run test:install && npm run test:e2e   # a11y (WCAG 2.2 AA, light+dark), cart flow with a faked Shopify, 320px overflow
    npm run format                # Prettier (Astro + Tailwind class sorting)
Commit `package-lock.json` after the first `npm install` so CI can use `npm ci`.

## Shopify setup
1. Import `shopify_products_import.csv` (includes 4 insurance products tagged `insurance`). Set real prices and premiums, then make products Active.
2. Create a custom app (or Headless channel), enable the Storefront API with product/cart/checkout read-write permissions, publish products to it.
3. Put the *.myshopify.com domain and Storefront token in `.env` and in Cloudflare Pages variables.
4. Paste the legal text from /legal into Shopify admin > Settings > Policies.
5. Optional: Shopify webhook (products/update) -> Cloudflare deploy hook, so the catalogue rebuilds on changes.

## Cloudflare Pages
Build command `npm run build`, output `dist`, `NODE_VERSION=22`.
Build variables: PUBLIC_SHOPIFY_DOMAIN, PUBLIC_SHOPIFY_STOREFRONT_TOKEN, PUBLIC_SHOPIFY_API_VERSION, SITE_URL. Changing them needs a redeploy.
Runtime secrets (Settings > Variables and Secrets > Secrets): see `.dev.vars.example`.

### Database for customers (Cloudflare D1, free tier)
    npx wrangler login
    npx wrangler d1 create hydraumatics-db                       # prints a database_id
    # paste the id into wrangler.toml (remove the # in front of the [[d1_databases]] block), or add a D1 binding named DB in the dashboard
    npx wrangler d1 migrations apply hydraumatics-db --remote    # creates the tables
Tables: `contacts` (one row per email), `quote_requests` (reference, details, status new/quoted/won/lost), `newsletter_subscribers` (status, proof of consent, unsubscribe token), `rate_limits` (24-hour spam control).
Browse data in the Cloudflare dashboard (Storage & Databases > D1 > hydraumatics-db > Console), or download CSV:
    curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://hgdmachines.online/api/admin/export?table=quotes" -o quotes.csv
    (tables: quotes, contacts, subscribers; add &status=subscribed for the mailing list). Disabled until you set the ADMIN_TOKEN secret.
Retention (privacy notice says 24 months for enquiries): run now and then
    npx wrangler d1 execute hydraumatics-db --remote --command "DELETE FROM contacts WHERE id NOT IN (SELECT contact_id FROM quote_requests WHERE created_at > date('now','-24 months')) AND email NOT IN (SELECT email FROM newsletter_subscribers WHERE status='subscribed')"
Test locally with the real functions:
    npm run build && npx wrangler d1 migrations apply hydraumatics-db --local && npx wrangler pages dev dist --d1=DB

### Email (pick one; Resend is the better long-term choice)
**Option A: Resend (recommended).** One provider sends everything: staff notifications (Reply-To = the customer), an acknowledgement to the customer, and the newsletter confirmation email (double opt-in).
1. Create an account at resend.com, then Domains > Add Domain > hgdmachines.online. Add the DNS records it shows in Cloudflare DNS (SPF/DKIM). They normally sit on a sending subdomain, so they should not clash with your mailbox provider; if you already have an SPF record, never create a second one for the same name.
2. When the domain shows "Verified", create an API key (sending access only).
3. In Cloudflare Pages > Settings > Variables and Secrets add secrets `RESEND_API_KEY` and `MAIL_FROM` = `Hydraumatics General Dealers <noreply@hgdmachines.online>`; redeploy and submit a test form.
4. Add a DMARC record in DNS: TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:info@hgdmachines.online` (tighten to `quarantine` after a few weeks of clean reports).
5. Web3Forms is then not used for anything: remove `WEB3FORMS_KEY` and edit the sentence about it in the privacy notice (`src/data/legal.json`).

**Option B: Web3Forms (simplest, nothing to verify).** It is only an email relay: our function posts the form to Web3Forms, which emails it to the inbox the key belongs to. Everything is still saved in D1.
1. web3forms.com > enter procurement@hgdmachines.online > copy the Access Key from the email they send.
2. Cloudflare Pages secret `WEB3FORMS_KEY` = that key. For newsletter signups to land in news@, create a second key for news@hgdmachines.online and set `NEWSLETTER_WEB3FORMS_KEY`.
3. Redeploy and test. No customer acknowledgement and no newsletter confirmation email are possible in this mode (single opt-in only).
Either provider receives the content of each message, so both are named as providers in the privacy notice.

Newsletters themselves are sent from your own tool: export `subscribers&status=subscribed` and import it (use each person's `unsub_token` to build `https://hgdmachines.online/unsubscribe?t=TOKEN`).

### If Google Search Console complains about robots.txt
1. Open https://hgdmachines.online/robots.txt in a browser. It should be exactly the 5 lines in `public/robots.txt`. If you see extra blocks (for example "BEGIN Cloudflare Managed content", `Content-Signal:` lines, or `Disallow: /` for AI bots), Cloudflare's managed robots.txt / AI-crawler blocking is rewriting it: switch it off in Cloudflare (Security > Settings or Bots > "Manage AI crawlers" / "robots.txt"), then re-check.
2. Search Console > Settings > robots.txt report shows the version Google fetched and any errors. After fixing, use "Request a recrawl" there. Google caches robots.txt for up to a day.
3. Search Console > Sitemaps: submit `sitemap-index.xml`. "Blocked by robots.txt" for URLs starting /api/ is intended and harmless.
4. Pages built with `PUBLIC_SHOPIFY_DOMAIN=mock` are deliberately `noindex`. Production must use the real Shopify values.

### Cloudflare dashboard settings that affect the Lighthouse score
- Security > Bots: turn off "JavaScript Detections" (it injects /cdn-cgi/challenge-platform scripts that trigger the "deprecated API" warnings; they are not from this code).
- Scrape Shield: turn off "Email Address Obfuscation" (it hides your public contact emails from crawlers and adds a script).
- Speed > Optimization: Rocket Loader off; Early Hints on; HTTP/3 on. Web Analytics is allowed by the CSP; remove its auto-injection if you do not want it (then update the Cookies page).
- Add a Redirect Rule www -> apex, Always Use HTTPS, SSL mode Full (strict).

## Where are the environment settings? (wrangler.toml)
`wrangler.toml` holds everything that is safe to commit: project name, output folder, runtime `[vars]` (STAFF_EMAIL, MAIL_FROM) and the D1 binding. Secrets (WEB3FORMS_KEY, NEWSLETTER_WEB3FORMS_KEY, RESEND_API_KEY, ADMIN_TOKEN, IP_SALT) must never be in a file in Git: set them with the `wrangler pages secret put` commands listed in that file, or in the dashboard. Public build-time values for Astro (Shopify domain, Storefront token, API version, SITE_URL) go in `.env.production` (copy `.env.production.example`). While a wrangler file with `[vars]` exists, the dashboard may show those variables as read-only.

## Images and video
Photos in `src/assets/images/` become AVIF + WebP + JPEG (several sizes) at build time. Videos: put sources in `media-src/`, run `npm run media` (needs ffmpeg) to create WebM + MP4 + poster in `public/media/`, then use `<VideoHero name="hero">` (WebM first, MP4 fallback, pause button, honours reduced motion). WebM is for video only, images use WebP/AVIF.

## Design decisions worth knowing
- **A production build fails if Shopify is unreachable**, so an empty shop can never be published. Only `PUBLIC_SHOPIFY_DOMAIN=mock` builds sample data.
- Pure logic (money, image URLs, insurance cover suggestion, quote-only rules) lives in `src/lib/utils.ts` and is unit-tested.
- Products with no price, or tagged `Special-Order`, cannot be added to the cart (quote only).
- Insurance is a normal Shopify product with a "Cover limit" variant per tier; cart lines are labelled "Covers: <item>". Selling insurance is regulated: agree the arrangement and premiums with a licensed insurer/broker (Pensions and Insurance Authority) before launch.
- Not yet done: a strict Content-Security-Policy (needs testing against the inline scripts), image optimisation for Shopify images via Astro's image service, a Shopify webhook rebuild, and screen-reader testing (do before launch).

## Legal and compliance checklist (a lawyer must review before launch)
- Legal pages: terms, shipping, returns, privacy, newsletter, insurance, tax, website terms, cookies/storage, accessibility (`src/data/legal.json`). Paste matching versions into Shopify Settings > Policies.
- Add your registered street/postal address and a phone number to the company details and footer (online sellers should show them).
- Confirm with counsel: registration as a data controller with the Office of the Data Protection Commissioner, cancellation/cooling-off rules for online orders, consumer-protection duties, and limits on liability and non-refundable deposits.
- Do NOT activate the insurance products in Shopify until a licensed insurer/broker arrangement and premium rates are in place; the Insurance page states that cover is arranged with a licensed insurer.
- Keep marketing claims consistent with the legal text (avoid "genuine OEM", "within 24 hours", "100% compliant").

## Status
Written without being able to install packages or run a build. First run: `npm install`, `npm run check`, `npm run dev`, then the tests. Send any errors back and they get fixed.
