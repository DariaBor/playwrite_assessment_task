import { expect, test } from "@playwright/test";
import { Page, Locator } from "@playwright/test";
import { BASE_URL } from "../utils/constants";
export class NewsletterInput {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"][name="email"]');
    this.submitButton = page.locator('input[type="submit"]');
    this.successMessage = page.locator('text="Thanks for subscribing!"');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async subscribe(email: string) {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }

  async getSuccessMessage() {
    this.successMessage.isVisible;
  }
}
let newsletter: NewsletterInput;
let shouldSkip = false;
const invalidEmails = [
  "test@",
  "@test.com",
  "test@testcom",
  "testmecom",
  "test.com",
  "",
];
test.describe("Newsletter Form Tests", () => {
  test.beforeEach(async ({ page }) => {
    newsletter = new NewsletterInput(page);
    await newsletter.goto();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  });

  test("TC-NL-001: Newsletter form should be present on the page", async ({}) => {
    try {
      await expect(newsletter.emailInput).toBeVisible();
      await expect(newsletter.submitButton).toBeVisible();
    } catch (err) {
      shouldSkip = true;
      throw err; // stops whole execution but requires fullyParallel: false and workers: 1 in playwrite config
    }
  });

  test("TC-NL-002: Form should validate invalid email input", async ({
    page,
  }) => {
    for (const email of invalidEmails) {
      await newsletter.subscribe(email);
      await expect(page.locator(".error-message")).toHaveText(
        /some invalid email error/i
      ); // in your case it does nothing, so test will fail, good practice to show some clear message so user understands what is wrong
    }
  });

  test("TC-NL-003: Form submission should work with valid email", async ({}) => {
    await newsletter.subscribe("user@example.com");
    await newsletter.getSuccessMessage();
  });
});

// ideally should be functionality and test for this which check user already subscribed on newsletters
