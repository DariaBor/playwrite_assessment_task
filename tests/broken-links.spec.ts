import { test, expect } from "@playwright/test";

test.describe("Broken Links Tests", () => {
  // Configure longer timeout for this test suite
  test.setTimeout(120000); // 2 minutes

  // Helper function to normalize URLs
  const normalizeUrl = (url: string, baseUrl: string): string | null => {
    try {
      // Handle relative URLs
      if (url.startsWith("/")) {
        return new URL(url, baseUrl).toString();
      }
      // Handle absolute URLs
      if (url.startsWith("http")) {
        return new URL(url).toString();
      }
      return null;
    } catch {
      return null;
    }
  };

  // Helper function to check if URL should be tested
  const shouldCheckUrl = (url: string): boolean => {
    const excludePatterns = [
      "#", // Anchor links
      "mailto:", // Email links
      "tel:", // Phone links
      "javascript:", // JavaScript links
      "data:", // Data URLs
      ".pdf", // PDFs
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".svg", // Images
      ".mp4",
      ".webm", // Videos
      ".mp3",
      ".wav", // Audio
      "localhost", // Local development URLs
      "chrome-extension://", // Chrome extensions
      "about:", // About URLs
    ];

    return !excludePatterns.some((pattern) =>
      url.toLowerCase().includes(pattern)
    );
  };

  test("TC-BL-001: Verify no broken links on important pages", async ({
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

    // Set to store already checked URLs
    const checkedUrls = new Set<string>();
    // Store broken links
    const brokenLinks: Array<{ page: string; link: string; status: number }> =
      [];
    // Store failed requests for reporting
    const failedRequests: Array<{ page: string; link: string; error: string }> =
      [];

    for (const pageUrl of importantPages) {
      console.log(`\nChecking links on ${pageUrl}`);

      try {
        // Navigate to the page and wait for network idle
        await page.goto(pageUrl, { waitUntil: "networkidle" });

        // Get all links on the page
        const links = await page
          .locator('a[href]:not([href^="javascript:"]):not([href^="#"])')
          .all();
        const hrefs: string[] = [];

        // Collect and normalize URLs
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

        // Take a sample of URLs if there are too many
        const maxLinksPerPage = 30;
        const urlsToCheck =
          hrefs.length > maxLinksPerPage
            ? hrefs.sort(() => 0.5 - Math.random()).slice(0, maxLinksPerPage)
            : hrefs;

        console.log(
          `Found ${hrefs.length} unique links, checking ${urlsToCheck.length} links...`
        );

        // Check each URL
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

            // Check for 404 and other client error status codes
            if (response.status() === 404) {
              brokenLinks.push({
                page: pageUrl,
                link: url,
                status: response.status(),
              });
              console.log(`Found broken link: ${url} (${response.status()})`);
            }

            // Rate limiting
            await page.waitForTimeout(200);
          } catch (error) {
            failedRequests.push({
              page: pageUrl,
              link: url,
              error: error.message,
            });
            console.log(`Failed to check URL: ${url} (${error.message})`);
          }
        }
      } catch (error) {
        console.log(`Failed to process page ${pageUrl}: ${error.message}`);
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

    // Test assertions
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
