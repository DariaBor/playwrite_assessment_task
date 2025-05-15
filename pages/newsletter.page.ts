// pages/newsletter.page.ts
import { Page, Locator } from "@playwright/test";

export class NewsletterInput {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator("#email");
    this.submitButton = page.locator("#submit");
    this.successMessage = page.locator(".success");
  }

  async subscribe(email: string) {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }

  async getSuccessMessage(): Promise<string | null> {
    return await this.successMessage.textContent();
  }
}
