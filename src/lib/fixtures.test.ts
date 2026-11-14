import { describe, expect, it } from "vitest";
import { fixtures } from "./fixtures";
import { coverLimit, isQuoteOnly, suggestCover } from "./utils";

const prices = (p: (typeof fixtures)[number]) => p.variants.map((v) => Number(v.price.amount));
const byHandle = (h: string) => fixtures.find((p) => p.handle === h)!;

describe("sample catalogue (mock mode)", () => {
  it("has unique ids and handles, and every product has a variant", () => {
    expect(new Set(fixtures.map((p) => p.handle)).size).toBe(fixtures.length);
    expect(new Set(fixtures.map((p) => p.id)).size).toBe(fixtures.length);
    for (const p of fixtures) expect(p.variants.length).toBeGreaterThan(0);
  });
  it("has unique Shopify variant ids", () => {
    const ids = fixtures.flatMap((p) => p.variants.map((v) => v.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("covers the cases the e2e tests rely on", () => {
    expect(isQuoteOnly(prices(byHandle("hydraulic-pumps")), byHandle("hydraulic-pumps").tags)).toBe(false);
    expect(isQuoteOnly(prices(byHandle("hydraulic-excavators")), byHandle("hydraulic-excavators").tags)).toBe(true);
    expect(isQuoteOnly(prices(byHandle("unpriced-item")), [])).toBe(true);
    expect(byHandle("safety-helmets").title).toBe("Safety helmets");
  });
  it("offers insurance cover in three ascending tiers, priced by rate", () => {
    const insurance = fixtures.filter((p) => p.productType === "Insurance");
    expect(insurance.length).toBeGreaterThanOrEqual(2);
    for (const p of insurance) {
      expect(p.variants.map((v) => coverLimit(v.title))).toEqual([5000, 25000, 100000]);
      expect(p.variants.every((v) => Number(v.price.amount) > 0)).toBe(true);
    }
    const marine = byHandle("overseas-freight-insurance");
    expect(marine.variants.map((v) => v.price.amount)).toEqual(["40.00", "200.00", "800.00"]);
  });
  it("suggests the 5,000 tier for a 1,800 pump order", () => {
    const marine = byHandle("overseas-freight-insurance");
    expect(suggestCover(marine.variants, 1800)?.title).toBe("Up to $5,000");
  });
});
