import { test, expect } from "@playwright/test";
import { XMLParser } from "fast-xml-parser";
import { BASE_URL, MAIN_PAGES, MAIN_HEAD_SELECTORS } from "../utils/constants";
test.describe("Sitemap and Crawlability Tests", () => {
  let sitemapUrls: string[] = [];
  test.beforeAll(async ({ request }) => {
    const response = await request.get(`${BASE_URL}sitemap.xml`);
    expect(response.ok()).toBeTruthy();
    const xmlContent = await response.text();
    const parser = new XMLParser();
    const parsedXml = parser.parse(xmlContent);
    expect(parsedXml.urlset).toBeDefined();
    const urls = parsedXml.urlset.url;
    sitemapUrls = Array.isArray(urls) ? urls.map((url) => url.loc) : [urls.loc];
  });
  test("TC-SM-001: sitemap.xml exists and is valid XML", async ({}) => {
    expect(sitemapUrls.length).toBeGreaterThan(0);
  });

  test("TC-SM-002: sample of sitemap URLs are accessible", async ({
    request,
  }) => {
    // Take a sample of URLs to test (to keep test duration reasonable)
    const sampleSize = 10;
    const sampleUrls = sitemapUrls
      .sort(() => 0.5 - Math.random()) // Shuffle array
      .slice(0, Math.min(sampleSize, sitemapUrls.length));

    for (const url of sampleUrls) {
      const response = await request.get(url);
      expect(response.ok(), `URL ${url} should be accessible`).toBeTruthy();
      const contentType = response.headers()["content-type"];
      expect(contentType).toContain("text/html");
    }
  });

  test("TC-SM-003: important pages are crawlable and dont have noindex", async ({
    page,
  }) => {
    for (const url of MAIN_PAGES) {
      await page.goto(url);
      await page.waitForLoadState("networkidle"); // ensure all network requests finished

      // check robots meta tag
      const robotsMeta = await page.locator('meta[name="robots"]').first();
      if ((await robotsMeta.count()) !== 0) {
        const content = await robotsMeta.getAttribute("content");
        expect(content, `${url} should not have noindex`).not.toContain(
          "noindex"
        );
      }

      // check canonical URL
      const canonical = await page.locator('link[rel="canonical"]').first();
      if ((await canonical.count()) !== 0) {
        const href = await canonical.getAttribute("href");
        expect(href, `${url} should have proper canonical URL`).toBeTruthy();
      }

      // Verify basic crawlability elements
      // chec title
      const title = await page.title();
      expect(title, `${url} should have a title`).toBeTruthy();

      // check meta description
      const metaDescription = await page
        .locator('meta[name="description"]')
        .first();
      if ((await metaDescription.count()) !== 0) {
        const content = await metaDescription.getAttribute("content");
        expect(content, `${url} should have meta description`).toBeTruthy();
      }

      // check heading structure

      const headingLocator = page.locator(MAIN_HEAD_SELECTORS.join(", "));
      const headingCount = await headingLocator.count();

      expect(
        headingCount,
        `${url} should have at least one main heading element`
      ).toBeGreaterThan(0);

      // Verify the page has a logical content structure
      const contentElements = await page
        .locator('main, article, section, [role="main"]')
        .count();
      expect(
        contentElements,
        `${url} should have proper content structure`
      ).toBeGreaterThan(0);
    }
  });

  test("TC-SM-004: verify robots.txt file", async ({ request }) => {
    const response = await request.get(`${BASE_URL}robots.txt`);
    expect(response.ok()).toBeTruthy();

    const robotsTxt = await response.text();
    expect(robotsTxt).toContain("User-agent:"); // check the structure
    expect(robotsTxt).toMatch(/Allow:|Disallow:/);
    expect(robotsTxt).toContain("Sitemap:");
  });
});
