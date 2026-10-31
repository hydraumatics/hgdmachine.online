import { PUBLIC_SHOPIFY_API_VERSION as version, PUBLIC_SHOPIFY_DOMAIN as domain, PUBLIC_SHOPIFY_STOREFRONT_TOKEN as token } from "astro:env/client";
import { fixtures } from "./fixtures";

export interface Money { amount: string; currencyCode: string }
export interface Variant { id: string; title: string; availableForSale: boolean; price: Money }
export interface Product {
  id: string; handle: string; title: string; description: string; descriptionHtml: string; productType: string; tags: string[];
  featuredImage: { url: string; altText: string | null; width: number; height: number } | null;
  variants: Variant[];
}

export const isMock = domain === "mock";

export async function sf<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!domain || !token) throw new Error("Shopify is not configured: set PUBLIC_SHOPIFY_DOMAIN and PUBLIC_SHOPIFY_STOREFRONT_TOKEN.");
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://${domain}/api/${version}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`Shopify ${res.status}`);
      if (!res.ok) throw new Error(`Shopify ${res.status}`);
      const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
      if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
      return json.data as T;
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
  throw lastError;
}

const PRODUCTS = `query($after:String){products(first:100,after:$after){
  pageInfo{hasNextPage endCursor}
  nodes{id handle title description descriptionHtml productType tags
    featuredImage{url altText width height}
    variants(first:20){nodes{id title availableForSale price{amount currencyCode}}}}}}`;

type ProductsResponse = { products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: (Omit<Product, "variants"> & { variants: { nodes: Variant[] } })[] } };

let cache: Promise<Product[]> | undefined;
/** Build-time catalogue. A production build FAILS if Shopify is unreachable, so an empty shop is never published. */
export function getAllProducts(): Promise<Product[]> {
  cache ??= (async () => {
    if (isMock) return fixtures;
    try {
      const all: Product[] = [];
      let after: string | null = null;
      for (;;) {
        const d: ProductsResponse = await sf<ProductsResponse>(PRODUCTS, { after });
        all.push(...d.products.nodes.map((p) => ({ ...p, variants: p.variants.nodes })));
        if (!d.products.pageInfo.hasNextPage) break;
        after = d.products.pageInfo.endCursor;
      }
      return all;
    } catch (e) {
      if (import.meta.env.PROD) throw e;
      console.warn("[shopify] could not load products (dev mode, continuing empty):", (e as Error).message);
      return [];
    }
  })();
  return cache;
}
export const isInsurance = (p: Product) => p.tags.includes("insurance");
export const fromPrice = (p: Product) => Math.min(...p.variants.map((v) => Number(v.price.amount)));
