import { test, expect } from "@playwright/test";
import { XMLParser } from "fast-xml-parser";

test.describe("Sitemap and Crawlability Tests", () => {
  let sitemapUrls: string[] = [];

  test("sitemap.xml exists and is valid XML", async ({ request }) => {
    // Fetch the sitemap
    const response = await request.get("https://www.netlify.com/sitemap.xml");
    expect(response.ok()).toBeTruthy();

    // Parse XML content
    const xmlContent = await response.text();
    const parser = new XMLParser();
    const parsedXml = parser.parse(xmlContent);

    // Verify sitemap has the expected structure
    expect(parsedXml.urlset).toBeDefined();
    expect(
      Array.isArray(parsedXml.urlset.url) || parsedXml.urlset.url
    ).toBeTruthy();

    // Store URLs for subsequent tests
    const urls = parsedXml.urlset.url;
    sitemapUrls = Array.isArray(urls) ? urls.map((url) => url.loc) : [urls.loc];

    // Verify we have URLs to test
    expect(sitemapUrls.length).toBeGreaterThan(0);
  });

  test("sample of sitemap URLs are accessible", async ({ request }) => {
    // Take a sample of URLs to test (to keep test duration reasonable)
    const sampleSize = 10;
    const sampleUrls = sitemapUrls
      .sort(() => 0.5 - Math.random()) // Shuffle array
      .slice(0, Math.min(sampleSize, sitemapUrls.length));

    for (const url of sampleUrls) {
      const response = await request.get(url);
      expect(response.ok(), `URL ${url} should be accessible`).toBeTruthy();

      // Check response headers for proper content type
      const contentType = response.headers()["content-type"];
      expect(contentType).toContain("text/html");
    }
  });

  test("important pages are crawlable and dont have noindex", async ({
    page,
  }) => {
    // List of important pages to check
    const importantPages = [
      "https://www.netlify.com/",
      "https://www.netlify.com/products/",
      "https://www.netlify.com/pricing/",
      "https://www.netlify.com/docs/",
      "https://www.netlify.com/blog/",
    ];

    for (const url of importantPages) {
      // Navigate to the page
      await page.goto(url);

      // Wait for the page to be fully loaded
      await page.waitForLoadState("networkidle");

      // Check for robots meta tag
      const robotsMeta = await page.locator('meta[name="robots"]').first();
      if ((await robotsMeta.count()) !== 0) {
        const content = await robotsMeta.getAttribute("content");
        expect(content, `${url} should not have noindex`).not.toContain(
          "noindex"
        );
      }

      // Check for canonical URL
      const canonical = await page.locator('link[rel="canonical"]').first();
      if ((await canonical.count()) !== 0) {
        const href = await canonical.getAttribute("href");
        expect(href, `${url} should have proper canonical URL`).toBeTruthy();
      }

      // Verify basic crawlability elements
      // Check for title
      const title = await page.title();
      expect(title, `${url} should have a title`).toBeTruthy();

      // Check for meta description
      const metaDescription = await page
        .locator('meta[name="description"]')
        .first();
      if ((await metaDescription.count()) !== 0) {
        const content = await metaDescription.getAttribute("content");
        expect(content, `${url} should have meta description`).toBeTruthy();
      }

      // Check for proper heading structure using multiple possible heading patterns
      const mainHeadingSelectors = [
        "h1",
        '[role="heading"][aria-level="1"]',
        ".heading-1",
        '[class*="title"]:not(meta)',
        '[class*="heading"]:not(meta)',
        'main h1, main [role="heading"]',
      ];

      // Join all selectors and look for any matching element
      const headingLocator = page.locator(mainHeadingSelectors.join(", "));
      const headingCount = await headingLocator.count();

      if (headingCount === 0) {
        // If no headings found, log the page content for debugging
        console.log(`Debug - Page title for ${url}:`, await page.title());
        console.log(
          `Debug - First main element content:`,
          await page.locator("main").first().innerText()
        );
      }

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

  test("verify no broken links on important pages", async ({
    page,
    request,
  }) => {
    // List of important pages to check
    const importantPages = [
      "https://www.netlify.com/",
      "https://www.netlify.com/products/",
      "https://www.netlify.com/pricing/",
      "https://www.netlify.com/docs/",
      "https://www.netlify.com/blog/",
    ];

    // Set to store already checked URLs to avoid duplicate checks
    const checkedUrls = new Set<string>();
    // Store any found broken links
    const brokenLinks: Array<{ page: string; link: string; status: number }> =
      [];

    for (const pageUrl of importantPages) {
      // Navigate to the page
      await page.goto(pageUrl);
      await page.waitForLoadState("networkidle");

      // Get all links on the page
      const links = await page.locator("a[href]").all();
      const hrefs: string[] = [];

      // Collect all href attributes
      for (const link of links) {
        const href = await link.getAttribute("href");
        if (href && !checkedUrls.has(href)) {
          hrefs.push(href);
          checkedUrls.add(href);
        }
      }

      // Filter and process links
      const validUrls = hrefs
        .filter(
          (href) =>
            // Filter out non-HTTP(S) links, anchors, and known valid patterns
            href.startsWith("http") &&
            !href.includes("#") && // Exclude anchor links
            !href.includes("mailto:") && // Exclude email links
            !href.includes("tel:") && // Exclude telephone links
            !href.includes("javascript:") && // Exclude javascript: links
            // Add common file extensions to exclude if needed
            ![".pdf", ".jpg", ".png", ".gif"].some((ext) =>
              href.toLowerCase().endsWith(ext)
            )
        )
        .slice(0, 50); // Limit to 50 links per page to keep test duration reasonable

      // Check each unique URL with rate limiting
      for (const url of validUrls) {
        try {
          const response = await request.get(url, {
            timeout: 10000, // 10 second timeout
            failOnStatusCode: false, // Don't fail on non-200 status codes
          });

          if (response.status() === 404) {
            brokenLinks.push({
              page: pageUrl,
              link: url,
              status: response.status(),
            });
          }

          // Rate limiting - wait 100ms between requests
          await page.waitForTimeout(100);
        } catch (error) {
          // Log failed requests but don't fail the test
          console.log(
            `Failed to check URL ${url} on page ${pageUrl}: ${error.message}`
          );
        }
      }
    }

    // Report broken links
    if (brokenLinks.length > 0) {
      console.log("\nBroken links found:");
      brokenLinks.forEach(({ page, link, status }) => {
        console.log(`Page: ${page}`);
        console.log(`Broken Link: ${link}`);
        console.log(`Status: ${status}\n`);
      });
    }

    // Assert no broken links were found
    expect(brokenLinks.length, "No broken links should be found").toBe(0);
  });

  test("verify robots.txt exists and is accessible", async ({ request }) => {
    const response = await request.get("https://www.netlify.com/robots.txt");
    expect(response.ok()).toBeTruthy();

    const robotsTxt = await response.text();

    // Verify basic robots.txt structure
    expect(robotsTxt).toContain("User-agent:");
    expect(robotsTxt).toMatch(/Allow:|Disallow:/);

    // Verify sitemap is referenced in robots.txt
    expect(robotsTxt).toContain("Sitemap:");
  });
});
