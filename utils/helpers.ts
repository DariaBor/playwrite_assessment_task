export const normalizeUrl = (url: string, baseUrl: string): string | null => {
    try {
      if (url.startsWith("/")) return new URL(url, baseUrl).toString();
      if (url.startsWith("http")) return new URL(url).toString();
      return null;
    } catch {
      return null;
    }
  };
  
  export const shouldCheckUrl = (url: string): boolean => {
    const excludePatterns = [
      "#", "mailto:", "tel:", "javascript:", "data:",
      ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg",
      ".mp4", ".webm", ".mp3", ".wav", "localhost",
      "chrome-extension://", "about:"
    ];
  
    return !excludePatterns.some(pattern => url.toLowerCase().includes(pattern));
  };