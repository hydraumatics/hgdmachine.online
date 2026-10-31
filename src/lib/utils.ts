/** Pure helpers: no DOM, no Astro imports, so they are unit-testable. */

export function money(amount: string | number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount));
}

/** Resize a Shopify CDN image safely, whether or not the URL already has a query string. */
export function imgUrl(url: string, width: number): string {
  const u = new URL(url);
  u.searchParams.set("width", String(width));
  return u.toString();
}

export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** "Up to $25,000" -> 25000 */
export function coverLimit(label: string): number {
  const nums = label.match(/[\d,]+/g);
  return nums ? Number(nums[nums.length - 1].replace(/,/g, "")) : 0;
}

/** Smallest cover limit that is at least the order value; otherwise the largest available. */
export function suggestCover<T extends { title: string }>(options: T[], orderValue: number): T | undefined {
  const sorted = [...options].sort((a, b) => coverLimit(a.title) - coverLimit(b.title));
  return sorted.find((o) => coverLimit(o.title) >= orderValue) ?? sorted[sorted.length - 1];
}

/** Items with no usable price, or special-order equipment, are quoted rather than sold online. */
export function isQuoteOnly(prices: number[], tags: string[]): boolean {
  return !prices.some((p) => p > 0) || tags.includes("Special-Order");
}
