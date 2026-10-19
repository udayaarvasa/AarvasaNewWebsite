/**
 * The one public origin search engines and link previews should see.
 *
 * aarvasa.com redirects to www (Amplify domain settings), so every canonical,
 * sitemap entry and Open Graph URL is built on www — never on the apex, an
 * Amplify branch domain or localhost, whichever host actually served the page.
 */
export const SITE_URL = "https://www.aarvasa.com";
export const SITE_NAME = "Aarvasa";

export const absoluteUrl = (path: string): string => new URL(path, SITE_URL).toString();
