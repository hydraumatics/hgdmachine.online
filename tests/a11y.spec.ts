import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = ["/", "/shop", "/products/hydraulic-pumps", "/products/hydraulic-excavators", "/legal", "/legal/terms", "/legal/privacy", "/legal/insurance", "/legal/cookies", "/newsletter", "/unsubscribe", "/contact"];
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
    const overflow = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const wide = [...document.body.querySelectorAll("*")]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > width + 1 && getComputedStyle(el).position !== "fixed"; })
        .slice(0, 8)
        .map((el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} class="${String(el.className).slice(0, 70)}" right=${Math.round(el.getBoundingClientRect().right)}`);
      return { scrollWidth: document.documentElement.scrollWidth, width, wide };
    });
    expect(overflow.scrollWidth <= overflow.width ? "no overflow" : `${path} overflows at 320px: ${JSON.stringify(overflow)}`).toBe("no overflow");
  }
});
