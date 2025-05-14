import { test, expect } from "@playwright/test";

interface BrokenLink {
  page: string;
  link: string;
  text: string;
  status?: number;
  error?: string;
}

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

  test("TC-BL-001: Check for broken links on main pages", async ({
    page,
    request,
  }) => {
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
      } catch {
        return "";
      }
    }

    const pagesToCheck = [
      "/",
      "/products/",
      "/pricing/",
      "/enterprise/",
      "/contact/",
    ];

    const brokenLinks: BrokenLink[] = [];
    const checkedUrls = new Set<string>();

    for (const pagePath of pagesToCheck) {
      const pageUrl = `${BASE_URL}${pagePath}`;
      console.log(`\nChecking links on page: ${pageUrl}`);

      try {
        await page.goto(pageUrl, {
          timeout: 30000,
          waitUntil: "networkidle",
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

          const absoluteUrl = resolveUrl(pageUrl, href);
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
                page: pageUrl,
                link: href,
                text: linkText?.trim() || "No link text",
                status,
              });
              console.log(`Found broken link: ${absoluteUrl} (${status})`);
            }
          } catch (error) {
            brokenLinks.push({
              page: pageUrl,
              link: href,
              text: linkText?.trim() || "No link text",
              error: error instanceof Error ? error.message : String(error),
            });
            console.log(`Error checking link ${absoluteUrl}: ${error}`);
          }
        }
      } catch (error) {
        console.error(`Error checking page ${pageUrl}:`, error);
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
