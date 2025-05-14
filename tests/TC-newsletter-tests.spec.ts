import { test, expect } from "@playwright/test";

test.describe("Newsletter Tests", () => {
  test("TC-NL-001: Verify newsletter form submission", async ({ page }) => {
    await page.goto("https://www.netlify.com/");
    await page.waitForLoadState("networkidle");

    const form = page.locator('form[name="newsletter"]');
    await form.waitFor({ state: "visible" });

    const emailInput = form.locator('input[type="email"]');
    await emailInput.fill("test@example.com");

    await form.locator('button[type="submit"]').click();

    const successMessage = page.locator('text="Thanks for subscribing!"');
    await expect(successMessage).toBeVisible();
  });

  test("TC-NL-002: Verify email validation", async ({ page }) => {
    await page.goto("https://www.netlify.com/");
    await page.waitForLoadState("networkidle");

    const form = page.locator('form[name="newsletter"]');
    await form.waitFor({ state: "visible" });

    const emailInput = form.locator('input[type="email"]');
    await emailInput.fill("invalid-email");

    await form.locator('button[type="submit"]').click();

    const isValid = await emailInput.evaluate((el) =>
      (el as HTMLInputElement).checkValidity()
    );
    expect(isValid).toBe(false);
  });

  test("TC-NL-003: Verify empty email validation", async ({ page }) => {
    await page.goto("https://www.netlify.com/");
    await page.waitForLoadState("networkidle");

    const form = page.locator('form[name="newsletter"]');
    await form.waitFor({ state: "visible" });

    await form.locator('button[type="submit"]').click();

    const emailInput = form.locator('input[type="email"]');
    await expect(emailInput).toBeFocused();
    const isRequired = await emailInput.evaluate(
      (el) => (el as HTMLInputElement).required
    );
    expect(isRequired).toBe(true);
  });
});
