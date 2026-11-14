# Deploy pipeline (GitHub Actions -> Cloudflare Pages)

Workflow: `.github/workflows/deploy.yml`. Package manager and script runner: **Bun**.

    verify  (types + unit tests)  --\
                                     >-- deploy (build -> wrangler pages deploy dist)
    e2e     (5 browser projects)  --/

- Push to `main`: production deploy. Pull request: preview deploy (forks are tested, not deployed).
- `deploy` only starts when `verify` and every `e2e` project are green.
- `bun run build` first runs `bun run images` (jpg/png -> AVIF + WebP in `public/images`).

## One-time setup

1. Cloudflare: create the Pages project once, with production branch `main`:
   `bunx wrangler pages project create hydraumatics-store --production-branch=main`
2. Cloudflare: create an API token with *Account > Cloudflare Pages > Edit* (add *D1 > Edit* if migrations should run).
3. GitHub > Settings > Secrets and variables > Actions:
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - Variables: `PUBLIC_SHOPIFY_DOMAIN`, `PUBLIC_SHOPIFY_STOREFRONT_TOKEN` (public by design), optional `PUBLIC_SHOPIFY_API_VERSION`, `SITE_URL`
   - Optional variable `D1_MIGRATIONS=true` once the `[[d1_databases]]` block in `wrangler.toml` is enabled.
4. Runtime secrets for the Functions (`WEB3FORMS_KEY`, `ADMIN_TOKEN`, ...) stay in Cloudflare, see `wrangler.toml`.
5. Turn off Cloudflare's own Git build for this repo, otherwise every push deploys twice.
6. Attach `hgdmachines.online` under Pages > Custom domains.

## Run the same checks locally

    bun install
    bun run check && bun run test
    bunx playwright install --with-deps && bun run test:e2e
