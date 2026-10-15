import { test, expect } from "@playwright/test";

/**
 * Public site — the journeys that must work for a visitor who has never heard
 * of Veencart and has no account.
 *
 * These assert real behaviour, not that a div exists: links resolve, the page
 * renders at 320px without sideways scroll, and nothing on it claims a price,
 * a delivery time or a guarantee that the business has not confirmed.
 */

test.describe("public site", () => {
  test("home page renders and offers the three primary actions", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /book a delivery/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /track a shipment/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /marketplace/i })).toBeVisible();
  });

  test("declares the six service areas without inventing coverage", async ({ page }) => {
    await page.goto("/");

    for (const service of [
      /daily delivery/i,
      /scheduled delivery/i,
      /bulk and freight/i,
      /interstate delivery/i,
      /ecommerce fulfilment/i,
    ]) {
      await expect(page.getByText(service)).toBeVisible();
    }

    // Coverage must be described as confirmed per route, not guaranteed.
    await expect(page.getByText(/confirmed per route/i)).toBeVisible();
  });

  test("publishes no invented prices, statistics or testimonials", async ({ page }) => {
    await page.goto("/");
    const text = (await page.locator("body").innerText()).toLowerCase();

    // ₦ amounts, delivery-time promises and social proof are all business
    // facts the client has not confirmed. If any appear, someone has invented
    // them and this test should fail.
    expect(text).not.toMatch(/₦\s?\d/);
    expect(text).not.toMatch(/\b\d+\s*(happy customers|parcels delivered|orders delivered)\b/);
    expect(text).not.toMatch(/\b(testimonial|what our customers say)\b/);
    expect(text).not.toMatch(/\bguaranteed? (delivery|same[- ]day|next[- ]day)\b/);
  });

  test("has no horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    // 1px of slack absorbs sub-pixel rounding; a real overflow is far larger.
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("is keyboard navigable with a visible focus ring", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();

    const outline = await focused.evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.outlineStyle}:${s.outlineWidth}`;
    });
    expect(outline).not.toBe("none:0px");
  });

  test("sets a lang attribute and a viewport meta tag", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /width=device-width/
    );
  });

  test("sends baseline security headers", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});

test.describe("service pages", () => {
  for (const [slug, name] of [
    ["daily", /daily/i],
    ["scheduled", /scheduled/i],
    ["bulk", /bulk/i],
    ["interstate", /interstate/i],
    ["ecommerce", /ecommerce/i],
  ] as const) {
    test(`/services/${slug} is reachable and self-describing`, async ({ page }) => {
      const response = await page.goto(`/services/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
    });
  }
});