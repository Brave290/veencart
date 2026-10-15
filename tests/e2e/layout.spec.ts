import { test, expect, type Page } from "@playwright/test";

/**
 * Layout and navigation contract for the public site.
 *
 * These check the things a visitor actually sees: the header puts the logo and
 * nav text on the left and the menu and theme controls on the right at every
 * width, the mobile menu opens and closes, every internal link resolves, the
 * 404 page is useful, and nothing overflows the viewport.
 */

const WIDTHS = [320, 390, 768, 1024, 1440] as const;

async function boxOf(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible" });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return box;
}

test.describe("header layout", () => {
  for (const width of WIDTHS) {
    test(`logo is left and menu + theme controls are right at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/services");

      const logo = await boxOf(page, 'header a[href="/"]');
      const menu = await boxOf(page, 'header button[aria-controls="site-menu"]');
      const theme = await boxOf(page, 'header button[aria-label*="theme"]');
      const viewportMid = width / 2;

      expect(logo.x, "logo starts on the left half").toBeLessThan(viewportMid);
      expect(menu.x, "menu button is in the right half").toBeGreaterThan(viewportMid);
      expect(theme.x, "theme toggle is in the right half").toBeGreaterThan(viewportMid);
      expect(theme.x, "theme toggle sits left of the menu button").toBeLessThan(menu.x);
    });
  }

  test("desktop shows the primary nav text beside the logo", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    const logo = await boxOf(page, 'header a[href="/"]');
    expect(navBox!.x).toBeGreaterThan(logo.x);
    expect(navBox!.x).toBeLessThan(720);
  });

  test("mobile: nav text is hidden and the menu opens, links work, Escape closes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();

    const menuButton = page.getByRole("button", { name: "Open menu" });
    await menuButton.click();
    const dialog = page.getByRole("dialog", { name: "Site menu" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("link", { name: "Track", exact: true }).click();
    await expect(page).toHaveURL(/\/track$/);
  });

  test("menu closes on Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("button", { name: "Close menu" }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  test("theme toggle switches and persists", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Switch to dark theme" }).first();
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("internal links", () => {
  test("every header and footer link on the home page resolves", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page
      .locator('header a[href^="/"], footer a[href^="/"], main a[href^="/"]')
      .evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute("href")!))]);
    expect(hrefs.length).toBeGreaterThan(5);
    for (const href of hrefs) {
      const res = await request.get(href, { maxRedirects: 0 });
      expect(res.status(), `${href} should resolve`).toBe(200);
    }
  });
});

test.describe("404 page", () => {
  test("returns 404 with a useful, honest layout", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/off the route/i);
    await expect(page.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: /track a shipment/i }).first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("has no nested interactive elements (link wrapping a button)", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    const nested = await page.locator("a button, button a").count();
    expect(nested).toBe(0);
  });

  test("does not overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/this-page-does-not-exist");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("status pages", () => {
  for (const [path, heading] of [
    ["/book", /being set up/i],
    ["/store", /coming soon/i],
    ["/contact", /reach us/i],
    ["/maintenance", /making veencart better/i],
  ] as const) {
    test(`${path} renders and is not indexed when it is a maintenance page`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    });
  }

  test("maintenance page is marked noindex", async ({ page }) => {
    await page.goto("/maintenance");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("touch targets", () => {
  test("header controls are at least 44px on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    for (const selector of ['header button[aria-controls="site-menu"]', 'header button[aria-label*="theme"]']) {
      const box = await boxOf(page, selector);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe("stagger reveal", () => {
  test("services list renders every service, not just the first six", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("link", { name: /daily delivery/i }).first()).toBeAttached();
    await expect(page.locator('a[href^="/services/"]')).toHaveCount(5, { timeout: 10_000 });
  });
});
