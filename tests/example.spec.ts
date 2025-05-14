import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("https://www.netlify.com/");
  await expect(page).toHaveTitle(/Netlify/);
});

test("has heading", async ({ page }) => {
  await page.goto("https://www.netlify.com/");
  await expect(page.locator("h1")).toBeVisible();
});
