import { test, expect } from "@playwright/test";

test.describe("Newsletter Form Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("https://www.netlify.com/");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  });

  test("TC-NL-001: Newsletter form should be present on the page", async ({
    page,
  }) => {
    const newsletterSection = page.getByText(
      "Stay up to date with Netlify news"
    );
    await expect(newsletterSection).toBeVisible();

    const emailInput = page.locator('input[type="email"][name="email"]');
    await expect(emailInput).toBeVisible();
  });

  test("TC-NL-002: Form should validate invalid email input", async ({
    page,
  }) => {
    const emailInput = page.locator('input[type="email"][name="email"]');
    await emailInput.fill("invalid-email");
    await emailInput.blur();
    await page.waitForTimeout(500);
    const isValid = await emailInput.evaluate((el) =>
      (el as HTMLInputElement).checkValidity()
    );
    expect(isValid).toBe(false);
  });

  test("TC-NL-003: Form should accept valid email input", async ({ page }) => {
    const emailInput = page.locator('input[type="email"][name="email"]');
    await emailInput.fill("test@example.com");
    await emailInput.blur();
    await page.waitForTimeout(500);
    const isValid = await emailInput.evaluate((el) =>
      (el as HTMLInputElement).checkValidity()
    );
    expect(isValid).toBe(true);
  });

  test("TC-NL-004: Form submission should work with valid email", async ({
    page,
  }) => {
    const emailInput = page.locator('input[type="email"][name="email"]');
    await emailInput.fill("test@example.com");
    const form = page.locator('form:has(input[type="email"][name="email"])');

    await page.route("**/api/v1/subscribe", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Submit the form
    await form.evaluate((formElement: HTMLFormElement) => {
      const submitEvent = new Event("submit", {
        bubbles: true,
        cancelable: true,
      });
      formElement.dispatchEvent(submitEvent);
    });
    await expect(emailInput).toHaveClass(/valid/);
  });
});
