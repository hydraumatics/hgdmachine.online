import { expect, test } from "@playwright/test";

const pages = ["/", "/shop", "/products/hydraulic-pumps"];

for (const path of pages) {
  test(`${path}: every image has alt text and actually loads`, async ({ page }) => {
    await page.goto(path);
    const result = await page.evaluate(async () => {
      const images = [...document.images];
      const loaded = await Promise.all(images.map((img) => { img.loading = "eager"; return img.decode().then(() => true, () => false); }));
      return images.map((img, i) => ({ src: img.currentSrc || img.src, hasAlt: img.hasAttribute("alt"), loaded: loaded[i] }));
    });
    expect(result.filter((i) => !i.hasAlt).map((i) => i.src)).toEqual([]);
    expect(result.filter((i) => !i.loaded).map((i) => i.src)).toEqual([]);
  });
}

test("home: photos are offered as AVIF and WebP, with a plain fallback", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('picture source[type="image/avif"]').first()).toBeAttached();
  await expect(page.locator('picture source[type="image/webp"]').first()).toBeAttached();
  await expect(page.locator("picture > img").first()).toHaveAttribute("src", /\.(jpe?g|png)$|\/_astro\//);
});

test("home: the browser downloads a modern format, not the original JPEG", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "older WebKit builds lack AVIF");
  const formats: string[] = [];
  page.on("response", (r) => { const t = r.headers()["content-type"] ?? ""; if (/^image\/(avif|webp|jpeg)/.test(t) && !r.url().includes("favicon")) formats.push(t); });
  await page.goto("/");
  await page.evaluate(() => Promise.all([...document.images].map((img) => { img.loading = "eager"; return img.decode().catch(() => {}); })));
  expect(formats.length).toBeGreaterThan(0);
  expect(formats.filter((f) => f.startsWith("image/jpeg"))).toEqual([]);
});
