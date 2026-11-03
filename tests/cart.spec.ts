import { expect, test, type Route } from "@playwright/test";

/** Fake Shopify Storefront API: answers cart mutations with a cart containing what was sent. */
function fakeShopify(route: Route) {
  const { query, variables } = route.request().postDataJSON() as { query: string; variables: { lines?: { merchandiseId: string; quantity: number; attributes?: { key: string; value: string }[] }[] } };
  const lines = (variables.lines ?? []).map((l, i) => ({
    id: `gid://shopify/CartLine/${i}`, quantity: l.quantity, attributes: l.attributes ?? [], cost: { totalAmount: { amount: String(l.quantity * 10), currencyCode: "USD" } },
    merchandise: { id: l.merchandiseId, title: l.merchandiseId.includes("ProductVariant/9") ? "Up to $5,000" : "Default Title", product: { title: l.merchandiseId.includes("ProductVariant/9") ? "Overseas Freight Insurance (Marine Cargo)" : "Hydraulic pumps", handle: "x" }, image: null },
  }));
  const cart = { id: "gid://shopify/Cart/1", checkoutUrl: "https://mock.example/checkout", totalQuantity: lines.reduce((n, l) => n + l.quantity, 0), cost: { subtotalAmount: { amount: "100", currencyCode: "USD" } }, lines: { nodes: lines } };
  const key = query.includes("cartCreate") ? "cartCreate" : "cartLinesAdd";
  return route.fulfill({ json: { data: { [key]: { cart, userErrors: [] }, cart } } });
}

test("add a product with insurance cover: cart opens, announces, lists both lines, links to checkout", async ({ page }) => {
  await page.route("**/graphql.json", fakeShopify);
  await page.goto("/products/hydraulic-pumps");
  await page.getByLabel("Overseas Freight Insurance (Marine Cargo)", { exact: true }).check();
  await page.getByRole("button", { name: "Add to cart" }).click();

  const cart = page.getByRole("dialog", { name: "Your cart" });
  await expect(cart).toBeVisible();
  await expect(cart.getByText("Hydraulic pumps")).toBeVisible();
  await expect(cart.getByText("Covers: Hydraulic pumps")).toBeVisible();
  await expect(cart.getByRole("link", { name: "Checkout securely" })).toHaveAttribute("href", "https://mock.example/checkout");

  await page.keyboard.press("Escape");
  await expect(cart).toBeHidden();
  await expect(page.getByRole("button", { name: /Open cart, 2 items/ })).toBeFocused();
});

test("quote-only products cannot be added to the cart", async ({ page }) => {
  await page.goto("/products/hydraulic-excavators");
  await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
  await expect(page.getByText("Quote on request").first()).toBeVisible();
});

test("shop search filters products", async ({ page }) => {
  await page.goto("/shop");
  await page.getByLabel("Search products").fill("helmet");
  await expect(page.getByRole("status").filter({ hasText: "product" })).toHaveText("1 product");
});

test("home: hero search lands on the shop with the query applied", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search the catalogue").fill("pump");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/shop\?q=pump/);
  await expect(page.getByLabel("Search products")).toHaveValue("pump");
  await expect(page.getByRole("status").filter({ hasText: "product" })).toHaveText("1 product");
});

test("home: FAQ opens with the keyboard", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard-only check");
  await page.goto("/#faq");
  const first = page.locator("#faq summary").first();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#faq details").first()).toHaveAttribute("open", "");
});

test("newsletter: consent is required, then signup shows a confirmation", async ({ page }) => {
  await page.route("**/api/newsletter", (route) =>
    route.fulfill({ status: 200, headers: { "content-type": "text/html", "X-Sent": "1" }, body: '<div class="ok">Thank you. Please check your inbox and confirm your subscription.</div>' }),
  );
  await page.goto("/newsletter");
  await page.getByLabel("Email address").fill("buyer@example.com");
  await page.getByRole("button", { name: "Subscribe" }).click();
  await expect(page.getByText("Thank you.")).toHaveCount(0); // blocked by the unticked consent box
  await page.getByLabel(/send me the Hydraumatics General Dealers newsletter/i).check();
  await page.getByRole("button", { name: "Subscribe" }).click();
  await expect(page.getByRole("status").getByText(/check your inbox/)).toBeVisible();
});

test("theme switch toggles dark mode, remembers it and exposes state", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Dark theme" });
  const before = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  await toggle.click();
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(!before);
  await expect(toggle).toHaveAttribute("aria-pressed", String(!before));
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(!before);
});

test("quote form: success message and reference come back from the API", async ({ page }) => {
  await page.route("**/api/quote", (route) => route.fulfill({ headers: { "content-type": "text/html", "X-Sent": "1" }, body: '<div class="ok">Thank you, Test. Your request reference is <b>HYD-261031-ABC123</b>.</div>' }));
  await page.goto("/#quote");
  await page.getByLabel("Full name and job title").fill("Test Buyer, Procurement");
  await page.getByLabel("Company or site").fill("Test Mine");
  await page.getByLabel("Work email").fill("buyer@example.com");
  await page.getByLabel(/What do you need/).fill("2 x hydraulic pump, Komatsu PC400");
  await page.getByLabel(/I agree that Hydraumatics/).check();
  await page.getByRole("button", { name: "Send quote request" }).click();
  await expect(page.getByRole("status").getByText(/HYD-261031-ABC123/)).toBeVisible();
});
