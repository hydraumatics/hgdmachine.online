import { describe, expect, it } from "vitest";
import { coverLimit, esc, imgUrl, isQuoteOnly, money, suggestCover } from "./utils";

describe("utils", () => {
  it("formats money", () => expect(money("1800.00", "USD")).toBe("$1,800"));
  it("adds width to URLs with and without a query", () => {
    expect(imgUrl("https://cdn.shopify.com/a.jpg?v=1", 500)).toBe("https://cdn.shopify.com/a.jpg?v=1&width=500");
    expect(imgUrl("https://cdn.shopify.com/a.jpg", 500)).toBe("https://cdn.shopify.com/a.jpg?width=500");
  });
  it("escapes html", () => expect(esc(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;"));
  it("parses cover limits", () => expect(coverLimit("Up to $25,000")).toBe(25000));
  it("suggests the smallest sufficient cover, else the largest", () => {
    const o = [{ title: "Up to $100,000" }, { title: "Up to $5,000" }, { title: "Up to $25,000" }];
    expect(suggestCover(o, 4000)?.title).toBe("Up to $5,000");
    expect(suggestCover(o, 26000)?.title).toBe("Up to $100,000");
    expect(suggestCover(o, 999999)?.title).toBe("Up to $100,000");
  });
  it("quote-only rules", () => {
    expect(isQuoteOnly([0], [])).toBe(true);
    expect(isQuoteOnly([10], ["Special-Order"])).toBe(true);
    expect(isQuoteOnly([10], [])).toBe(false);
  });
});

import { breadcrumbs, jsonLdString } from "./seo";
describe("seo", () => {
  it("escapes < in JSON-LD so it cannot close the script tag", () => {
    expect(jsonLdString({ a: "</script><b>" })).not.toContain("</script>");
    expect(JSON.parse(jsonLdString({ a: "</script>" })).a).toBe("</script>");
  });
  it("builds ordered breadcrumbs with absolute URLs", () => {
    const b = breadcrumbs([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }]);
    expect(b.itemListElement[1]).toMatchObject({ position: 2, item: "https://hgdmachines.online/shop" });
  });
});
