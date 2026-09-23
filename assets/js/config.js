/*
 * Site settings for cledispo.com (Right Price Dispositions).
 * This is the ONLY file that needs editing to connect the site to live data.
 */
window.SITE_CONFIG = {
  /*
   * LISTINGS_CSV_URL — where the site reads the deal list from.
   *
   * Leave empty ("") to use the bundled file data/listings.csv.
   *
   * To run the site from the Google Sheet Lily maintains, paste a CSV link here.
   * Either of these works (the sheet/tab must be named "Listings"):
   *
   *   1) Google Sheets "gviz" CSV (sheet shared as "Anyone with the link – Viewer"):
   *      https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&headers=1&sheet=Listings
   *
   *   2) File > Share > Publish to web > "Listings" tab > CSV:
   *      https://docs.google.com/spreadsheets/d/e/<PUBLISHED_ID>/pub?gid=<TAB_GID>&single=true&output=csv
   *
   * If this link is empty, broken, or not public, the site quietly falls back
   * to data/listings.csv so the page never shows up blank.
   */
  LISTINGS_CSV_URL: "",

  /*
   * FORM_ENDPOINT — where the three forms (property inquiry, buyers list,
   * contact) send their data. Any URL that accepts a JSON POST works:
   * a Zapier / Make "Catch Hook" webhook, a Google Apps Script web app, the
   * new CRM's webhook, Formspree, etc.
   *
   * Leave empty ("") while testing: submissions are printed to the browser
   * console and the visitor still lands on the thank-you page.
   */
  FORM_ENDPOINT: "",

  /*
   * FORM_SEND_AS_TEXT — set to true if the endpoint is a Google Apps Script
   * web app (or anything that rejects cross-site "application/json" requests).
   * The body is still the same JSON; only the Content-Type header changes to
   * text/plain, which browsers send without a CORS pre-check.
   */
  FORM_SEND_AS_TEXT: false,

  /* Contact details shown across the site */
  PHONE_DISPLAY: "(216) 930-3281",
  PHONE_E164: "+12169303281",
  EMAIL: "sales@rightpricehomebuyers.com",
  INSTAGRAM_URL: "https://www.instagram.com/rightpricehomebuyers?utm_source=ig_web_button_share_sheet&igsh=dnZweTU5Y2hhZjhn",
  FACEBOOK_URL: "https://www.facebook.com/profile.php?id=61578637402555",
  SITE_URL: "https://www.cledispo.com/"
};
