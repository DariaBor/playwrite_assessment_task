import { test, expect } from "@playwright/test";
import { XMLParser } from "fast-xml-parser";

test.describe.configure({ retries: 2 });

interface BrokenLink {
  page: string;
  link: string;
  text: string;
  status?: number;
  error?: string;
}

test.describe("Sitemap Tests", () => {
  test("TC-SM-001: Verify sitemap.xml is accessible", async ({ request }) => {
    const response = await request.get("https://www.netlify.com/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/xml");
  });

  test("TC-SM-002: Verify sitemap contains valid URLs", async ({ request }) => {
    const response = await request.get("https://www.netlify.com/sitemap.xml");
    const xmlContent = await response.text();
    const parser = new XMLParser();
    const parsedXml = parser.parse(xmlContent);
    expect(parsedXml.urlset).toBeDefined();
    expect(Array.isArray(parsedXml.urlset.url)).toBe(true);
    expect(parsedXml.urlset.url.length).toBeGreaterThan(0);
    for (const urlEntry of parsedXml.urlset.url) {
      expect(urlEntry.loc).toBeDefined();
      expect(urlEntry.loc).toMatch(/^https:\/\/www\.netlify\.com\//);
    }
  });

  test("TC-SM-003: Verify robots.txt configuration", async ({ request }) => {
    const response = await request.get("https://www.netlify.com/robots.txt");
    expect(response.status()).toBe(200);
    const robotsTxt = await response.text();
    expect(robotsTxt).toContain("Sitemap:");
    expect(robotsTxt).toContain("sitemap.xml");
  });

  test("TC-SM-004: Verify important pages have proper heading structure", async ({
    page,
  }) => {
    test.slow();
    const importantPages = [
      "https://www.netlify.com/",
      "https://www.netlify.com/products/",
      "https://www.netlify.com/pricing/",
    ];

    for (const url of importantPages) {
      console.log(`\nChecking heading structure for ${url}`);
      try {
        await test.step(`Navigate to ${url}`, async () => {
          await page.goto(url, {
            timeout: 45000,
            waitUntil: "networkidle",
          });
        });

        await test.step("Wait for content", async () => {
          await page.waitForLoadState("domcontentloaded");
          await page.waitForSelector("main", { timeout: 10000 }).catch(() => {
            console.log("Main element not found, continuing with test...");
          });
        });

        await test.step("Check main heading", async () => {
          const mainHeadingSelectors = [
            "h1",
            '[role="heading"][aria-level="1"]',
            '[class*="heading"][class*="h1"]',
            '[class*="title"][class*="h1"]',
            '[class*="heading-1"]',
            '[class*="title-1"]',
          ];

          let mainHeadingFound = false;
          for (const selector of mainHeadingSelectors) {
            const headings = await page.locator(selector).all();
            if (headings.length > 0) {
              mainHeadingFound = true;
              for (const heading of headings) {
                const text = await heading.textContent();
                console.log(
                  `Main heading found (${selector}): "${text?.trim()}"`
                );
              }
              break;
            }
          }
          expect(
            mainHeadingFound,
            `Page ${url} should have at least one main heading`
          ).toBeTruthy();
        });

        await test.step("Check heading structure", async () => {
          const allHeadingsSelector = `
            h1, h2, h3, h4, h5, h6,
            [role="heading"][aria-level],
            [class*="heading"][class*="h"],
            [class*="title"][class*="h"]
          `;

          const allHeadings = await page.locator(allHeadingsSelector).all();
          console.log("\nComplete heading structure:");
          for (const heading of allHeadings) {
            const text = await heading.textContent();
            if (text) {
              console.log(`- ${text.trim()}`);
            }
          }
          expect(
            allHeadings.length,
            `Page ${url} should have a proper heading structure`
          ).toBeGreaterThan(1);
        });
      } catch (error) {
        console.error(`Error checking page ${url}:`, error);
        throw error;
      }
    }
  });

  test("TC-SM-005: Check for broken links", async ({ page, request }) => {
    test.slow();
    const BASE_URL = "https://www.netlify.com";

    function resolveUrl(baseUrl: string, relativeUrl: string): string {
      try {
        if (
          relativeUrl.startsWith("http://") ||
          relativeUrl.startsWith("https://")
        ) {
          return relativeUrl;
        }
        const url = new URL(relativeUrl, baseUrl);
        return url.toString();
      } catch (error) {
        console.log(`Error resolving URL ${relativeUrl}:`, error);
        return "";
      }
    }

    const response = await request.get(`${BASE_URL}/sitemap.xml`);
    const xmlContent = await response.text();
    const parser = new XMLParser();
    const parsedXml = parser.parse(xmlContent);
    const urlsToCheck = parsedXml.urlset.url
      .slice(0, 10)
      .map((entry) => entry.loc);

    const brokenLinks: BrokenLink[] = [];
    const checkedUrls = new Set<string>();

    for (const url of urlsToCheck) {
      console.log(`\nChecking links on page: ${url}`);
      try {
        await test.step(`Navigate to ${url}`, async () => {
          await page.goto(url, {
            timeout: 45000,
            waitUntil: "networkidle",
          });
        });

        const links = await page.locator("a[href]").all();
        console.log(`Found ${links.length} links on the page`);

        for (const link of links) {
          const href = await link.getAttribute("href");
          const linkText = await link.textContent();

          if (!href) continue;
          if (href.startsWith("#")) continue;
          if (href.startsWith("mailto:")) continue;
          if (href.startsWith("tel:")) continue;
          if (href.startsWith("javascript:")) continue;

          const absoluteUrl = resolveUrl(url, href);
          if (!absoluteUrl) continue;

          if (checkedUrls.has(absoluteUrl)) continue;
          checkedUrls.add(absoluteUrl);

          if (!absoluteUrl.includes("netlify.com")) {
            console.log(`Skipping external URL: ${absoluteUrl}`);
            continue;
          }

          try {
            const linkResponse = await request.head(absoluteUrl, {
              timeout: 10000,
              failOnStatusCode: false,
            });

            const status = linkResponse.status();
            if (status >= 400) {
              brokenLinks.push({
                page: url,
                link: href,
                text: linkText?.trim() || "No link text",
                status,
              });
              console.log(`Found broken link: ${absoluteUrl} (${status})`);
            }
          } catch (error) {
            brokenLinks.push({
              page: url,
              link: href,
              text: linkText?.trim() || "No link text",
              error: error instanceof Error ? error.message : String(error),
            });
            console.log(`Error checking link ${absoluteUrl}: ${error}`);
          }
        }
      } catch (error) {
        console.error(`Error checking page ${url}:`, error);
      }
    }

    const brokenLinksMessage =
      brokenLinks.length === 0
        ? "No broken links found"
        : `Found ${brokenLinks.length} broken links:\n${brokenLinks
            .map(
              ({ page, link, text, status, error }) =>
                `- Page: ${page}\n  Link: ${link}\n  Text: ${text}\n  ${
                  status ? `Status: ${status}` : `Error: ${error}`
                }\n`
            )
            .join("\n")}`;

    console.log("\nBroken Links Report:", brokenLinksMessage);
    expect(brokenLinks.length, brokenLinksMessage).toBe(0);
  });
});
