import { expect, test } from "@playwright/test";

const pages = ["/", "/shop", "/products/hydraulic-pumps", "/products/hydraulic-excavators", "/legal", "/legal/terms", "/legal/privacy", "/newsletter", "/unsubscribe", "/contact"];

for (const path of pages) {
  test(`${path}: loads, has one h1, a title and no console errors`, async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    expect((await page.title()).trim().length).toBeGreaterThan(5);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{20,}/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    expect(problems).toEqual([]);
  });
}

test("unknown URLs return the 404 page with a real 404 status", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("couldn");
});

test("sitemap, robots.txt and llms.txt are published", async ({ request }) => {
  const sitemap = await request.get("/sitemap-index.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("sitemap-0.xml");
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap:");
  const llms = await request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  expect(await llms.text()).toContain("Hydraumatics General Dealers");
});

test("structured data on the home page is valid JSON and names the organisation", async ({ page }) => {
  await page.goto("/");
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocks.length).toBeGreaterThan(0);
  // The home page publishes one block with an "@graph"; other pages publish a single object.
  const nodes = blocks.flatMap((b) => { const j = JSON.parse(b); return j["@graph"] ?? [j]; });
  const types = nodes.flatMap((n) => [n["@type"]].flat());
  expect(types).toContain("Organization");
});

test("unsubscribe: shows the server's answer without a page reload", async ({ page }) => {
  await page.route("**/api/unsubscribe", (route) =>
    route.fulfill({ headers: { "content-type": "text/html" }, body: '<div class="ok">Done. If that address was subscribed, it has been removed from the newsletter.</div>' }),
  );
  await page.goto("/unsubscribe");
  await page.locator("#unsub").getByLabel("Email address").fill("buyer@example.com");
  await page.locator("#unsub").getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByRole("status").getByText(/has been removed/)).toBeVisible();
});
