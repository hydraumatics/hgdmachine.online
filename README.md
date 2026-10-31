# Hydraumatics store (Astro 7 + Starwind UI + Shopify)

Static site on Cloudflare Pages. Products and cart come from Shopify's Storefront API; **checkout is Shopify's**.

## Stack
- Astro 7, TypeScript (strict), Tailwind CSS 4
- Starwind UI components (copied into `src/components/starwind`, MIT, yours to edit). Dialogs and sheets use native `<dialog>`.
- astro-seo, @astrojs/sitemap, Astro ClientRouter (page transitions)
- htmx + `functions/api/quote.js` (Cloudflare Pages Function) for the quote form, delivered by Web3Forms
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
Build command `npm run build`, output `dist`. Variables: PUBLIC_SHOPIFY_DOMAIN, PUBLIC_SHOPIFY_STOREFRONT_TOKEN, PUBLIC_SHOPIFY_API_VERSION, and secret WEB3FORMS_KEY (get it at web3forms.com).

## Design decisions worth knowing
- **A production build fails if Shopify is unreachable**, so an empty shop can never be published. Only `PUBLIC_SHOPIFY_DOMAIN=mock` builds sample data.
- Pure logic (money, image URLs, insurance cover suggestion, quote-only rules) lives in `src/lib/utils.ts` and is unit-tested.
- Products with no price, or tagged `Special-Order`, cannot be added to the cart (quote only).
- Insurance is a normal Shopify product with a "Cover limit" variant per tier; cart lines are labelled "Covers: <item>". Selling insurance is regulated: agree the arrangement and premiums with a licensed insurer/broker (Pensions and Insurance Authority) before launch.
- Not yet done: a strict Content-Security-Policy (needs testing against the inline scripts), image optimisation for Shopify images via Astro's image service, a Shopify webhook rebuild, and screen-reader testing (do before launch).

## Status
Written without being able to install packages or run a build. First run: `npm install`, `npm run check`, `npm run dev`, then the tests. Send any errors back and they get fixed.
