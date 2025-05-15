import { test, expect } from "@playwright/test";
import { IMPORTANT_PAGES, MAX_LINKS_PER_PAGE } from "../utils/constants";
import { normalizeUrl, shouldCheckUrl } from "../utils/helpers";
test.describe("Broken Links Tests", () => {
  test.setTimeout(120000); // 2 minutes

  // function to check if URL should be tested
  test("TC-BL-001: Verify no broken links on important pages", async ({
    page,
    request,
  }) => {
    const checkedUrls = new Set<string>();
    const brokenLinks: Array<{ page: string; link: string; status: number }> =
      [];
    const failedRequests: Array<{ page: string; link: string; error: string }> =
      [];

    for (const pageUrl of IMPORTANT_PAGES) {
      try {
        await page.goto(pageUrl, { waitUntil: "networkidle" });
        //store links on the page
        const links = await page
          .locator('a[href]:not([href^="javascript:"]):not([href^="#"])')
          .all();
        const hrefs: string[] = [];
        for (const link of links) {
          const href = await link.getAttribute("href");
          if (!href) continue;

          const normalizedUrl = normalizeUrl(href, pageUrl);
          if (
            normalizedUrl &&
            !checkedUrls.has(normalizedUrl) &&
            shouldCheckUrl(normalizedUrl)
          ) {
            hrefs.push(normalizedUrl);
            checkedUrls.add(normalizedUrl);
          }
        }

        // define max amount of links since there are too many, adjust in constants if needed
        const urlsToCheck =
          hrefs.length > MAX_LINKS_PER_PAGE
            ? hrefs.sort(() => 0.5 - Math.random()).slice(0, MAX_LINKS_PER_PAGE)
            : hrefs;

        // check each link
        for (const url of urlsToCheck) {
          try {
            const response = await request.head(url, {
              timeout: 15000,
              failOnStatusCode: false,
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (compatible; PlaywrightBot/1.0; +http://localhost)",
              },
            });

            // check for errro status codes
            if (response.status() === 404) {
              brokenLinks.push({
                page: pageUrl,
                link: url,
                status: response.status(),
              });
            }

            // Rate limiting
            await page.waitForTimeout(200);
          } catch (error) {
            failedRequests.push({
              page: pageUrl,
              link: url,
              error: error.message,
            });
            console.log(`Failed URL: ${url} (${error.message})`);
          }
        }
      } catch (error) {
        console.log(`Failed to proccess page ${pageUrl}: ${error.message}`);
        continue;
      }
    }

    // Report results
    if (brokenLinks.length > 0 || failedRequests.length > 0) {
      console.log("\n=== Test Results ===");

      if (brokenLinks.length > 0) {
        console.log("\nBroken Links Found:");
        brokenLinks.forEach(({ page, link, status }) => {
          console.log(`\nPage: ${page}`);
          console.log(`Link: ${link}`);
          console.log(`Status: ${status}`);
        });
      }

      if (failedRequests.length > 0) {
        console.log("\nFailed Requests:");
        failedRequests.forEach(({ page, link, error }) => {
          console.log(`\nPage: ${page}`);
          console.log(`Link: ${link}`);
          console.log(`Error: ${error}`);
        });
      }
    }

    //  assertions
    const brokenLinksMessage =
      brokenLinks.length > 0
        ? `Found ${brokenLinks.length} broken links:\n${brokenLinks
            .map(
              ({ page, link, status }) =>
                `  - ${link} (${status}) on page: ${page}`
            )
            .join("\n")}`
        : "No broken links (404s) should be found";

    expect(brokenLinks.length, brokenLinksMessage).toBe(0);
    expect(failedRequests.length, "No failed requests should occur").toBe(0);
  });
});
