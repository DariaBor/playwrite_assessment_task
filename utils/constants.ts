export const BASE_URL = "https://www.netlify.com/";
export const IMPORTANT_PAGES = [
  BASE_URL,
  `${BASE_URL}products/`,
  `${BASE_URL}pricing/`,
  `${BASE_URL}ocs/`,
  `${BASE_URL}blog/`,
];

export const MAX_LINKS_PER_PAGE = 30;
export const MAIN_PAGES = [
  BASE_URL,
  `${BASE_URL}products/`,
  `${BASE_URL}pricing/`,
  `${BASE_URL}docs/`,
  `${BASE_URL}blog/`,
];
export const MAIN_HEAD_SELECTORS = [
  "h1",
  '[role="heading"][aria-level="1"]',
  ".heading-1",
  '[class*="title"]:not(meta)',
  '[class*="heading"]:not(meta)',
  'main h1, main [role="heading"]',
];
