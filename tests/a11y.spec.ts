import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = ["/", "/shop", "/products/hydraulic-pumps", "/products/hydraulic-excavators", "/legal", "/legal/terms", "/legal/privacy"];
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe, ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });
    for (const path of pages) {
      test(`no WCAG violations on ${path}`, async ({ page }) => {
        await page.goto(path);
        const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.length} node(s) – ${v.help}`)).toEqual([]);
      });
    }
  });
}

test("skip link is the first tab stop", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard-only check");
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
});

test("no horizontal scrolling at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ["/", "/shop", "/products/hydraulic-pumps"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});
