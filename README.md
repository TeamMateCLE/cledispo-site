# cledispo.com: Right Price Dispositions (static site)

This site replaces the ReSimpli-hosted cledispo.com, so it keeps working after ReSimpli is cancelled. It is plain HTML, CSS and JavaScript with no build step. Every link is relative, so the folder works from any host root (Netlify, Cloudflare Pages, GitHub Pages, GoDaddy hosting, S3). All fonts, logos and photos are local, and nothing loads from ReSimpli or WordPress.

The design and branding match rightpricehomebuyers.com: the fox logo, navy `#112337`, blue `#204ce5` / `#527EFF`, off-white `#F5F5F5` / `#fffaf3`, and the Satoshi font (self-hosted from Fontshare under the free ITF license).

## Pages

| URL | What it is |
|---|---|
| `/` | Home page: hero with the newest available deal, featured deals, a "recently sold" strip (shown only when sold deals exist), how it works, why buy from us, a buyers-list call to action and contact tiles |
| `/listings/` | All deals, with a status filter (All / Available / Pending / Sold), minimum beds and baths, a min/max price filter and sorting (newest, price low to high, price high to low). Filters are saved in the URL, so a link like `/listings/?status=sold` can be shared |
| `/property/?id=<id>` | One template for every deal: photo gallery with a full-screen lightbox (swipe, arrow keys, thumbnails), price card with ARV, rehab and estimated spread or equity, property facts, description, Google map, the "Request info / make an offer" form and a share button. On phones a sticky Call / Request info bar sits at the bottom |
| `/buyers-list/` | Buyers-list sign-up form |
| `/contact/` | Contact tiles and a contact form |
| `/thank-you/` | Where every form lands; the message changes per form |
| `/privacy-policy/`, `/terms-of-use/` | Text copied word for word from the old site |
| `/listing/` → `/listings/`, `/contact-us/` → `/contact/` | Redirect stubs so old links keep working |
| `404.html` | "Page not found". Old deal links such as `/property/41-e-173rd-st-cleveland-44128-value-add-.../` are sent to the matching new deal page. This page uses root-absolute links (`/listings/`) on purpose, because hosts serve it at any path |

Other files: `robots.txt`, `sitemap.xml`, and `assets/img/og-image.jpg` (the 1200×630 image shown when a link is shared).

Not needed for hosting: `_dev/` holds the checker script and test CSVs, and `_screenshots/` holds review screenshots. Leave both out when uploading.

## Listings data (Google Sheet)

The site reads deals when each page loads:

1. If `LISTINGS_CSV_URL` in `assets/js/config.js` is filled in, the site reads that Google Sheet CSV.
2. If that link is empty, broken, slow (over 8 seconds) or not public, the site quietly uses the bundled `data/listings.csv` instead.

To connect Lily's sheet:

- Name the tab `Listings`, and make row 1 the exact headers listed below.
- Choose one of these two ways to publish it:
  - **Share the sheet** as "Anyone with the link: Viewer" and use `https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&headers=1&sheet=Listings`
  - **Or use File → Share → Publish to web**, choose the Listings tab and "Comma-separated values", and paste the link it gives you (`.../pub?gid=...&single=true&output=csv`).
- Tip: format the whole sheet as **Format → Number → Plain text**. The "gviz" link guesses a type for each column and can blank out cells that don't fit the guess, for example `115k` in a column of plain numbers. The Publish-to-web link doesn't have this problem.
- Changes can take a few minutes to show on the site because Google caches the CSV.

### Columns (header names must match exactly; letter case and spaces don't matter)

| Column | Required | Notes |
|---|---|---|
| `id` | yes | Short web-safe name used in the link, e.g. `41-e-173rd-st`. Must be unique. If blank, one is made from the address |
| `status` | yes | `Available`, `Pending` or `Sold`. Sold deals get a red SOLD ribbon, which works as social proof. Optional extra: `Hidden` removes a row from the site without deleting it |
| `address` | yes | Street address as buyers should see it. A masked number like `41** E 173rd St` is allowed; the map then shows the street instead of a wrong pin |
| `city`, `state`, `zip` | recommended | |
| `price` | no | Asking price. `115000`, `$115,000` and `115k` all work. Blank shows "Contact for price" |
| `arv` | no | After-repair value |
| `rehab_estimate` | no | Rehab estimate |
| `beds`, `baths`, `sqft` | no | Numbers; `2.5` baths and `1,007` sqft are fine |
| `year_built`, `lot_size`, `property_type`, `garage` | no | Free text. A plain-number lot size is shown as sq ft |
| `description` | no | Free text. Line breaks become paragraphs. Commas, quotes and new lines are fine |
| `photos` | no | One or more photo links, one per line in the cell (Alt+Enter) or separated by commas. The first photo is the cover |
| `featured` | no | `yes` puts an available deal first on the home page |
| `date_listed` | no | `YYYY-MM-DD`; controls "newest" sorting |

Blank fields are hidden. The spread box shows **Estimated spread** (ARV minus price) when price and ARV are filled in, and **Estimated equity** (ARV minus price minus rehab) when the rehab estimate is also filled in. If there are no deals, visitors see "New deals coming soon" with a buyers-list button.

Example row (the seed deal, shortened):

```csv
id,status,address,city,state,zip,price,arv,rehab_estimate,beds,baths,sqft,year_built,lot_size,property_type,garage,description,photos,featured,date_listed
41-e-173rd-st,Available,41** E 173rd St,Cleveland,OH,44128,115000,175000,,3,2,1007,1954,,Single Family,Detached Garage,"VALUE ADD OPPORTUNITY!! ...","assets/img/listings/41-e-173rd-st/01.jpg
assets/img/listings/41-e-173rd-st/02.jpg",yes,2026-08-19
```

### How photos work

- **Normal image links** (`https://.../photo.jpg`) are used as they are.
- **Google Drive links** such as `https://drive.google.com/file/d/<ID>/view?usp=sharing` or `https://drive.google.com/open?id=<ID>` are converted automatically to `https://drive.google.com/thumbnail?id=<ID>&sz=w1600`. **Each photo, or the folder it is in, must be shared as "Anyone with the link".** Otherwise visitors see a grey placeholder instead of the photo.
- **Photos stored with the site** use a relative path such as `assets/img/listings/<id>/01.jpg`. The 63 photos of 41** E 173rd St are stored this way. They were copied from ReSimpli and resized to 1600 px wide, so they survive the shutdown and load fast.

## Settings to fill in (`assets/js/config.js`)

| Setting | What to put |
|---|---|
| `LISTINGS_CSV_URL` | The Google Sheet CSV link above. Leave `""` to use `data/listings.csv` |
| `FORM_ENDPOINT` | The URL that receives form submissions (Zapier/Make webhook, Google Apps Script web app, new CRM webhook, Formspree). While it is `""`, submissions are printed to the browser console only and **nothing is delivered**, but visitors still see the thank-you page |
| `FORM_SEND_AS_TEXT` | `true` for a Google Apps Script endpoint (it rejects cross-site JSON). This sends the same JSON with a `text/plain` header |
| Phone, email, Instagram, Facebook, site URL | Already filled in. The same details are also written into the page HTML, so a change must be made in both places |

## Form payload

All three forms POST one JSON object to `FORM_ENDPOINT`. Every form includes `form_name`, `page_url`, `submitted_at` (ISO time), `source: "cledispo.com"` and the fields below. Phone numbers are sent formatted as `(216) 555-0123`.

```jsonc
// form_name: "property-inquiry"
{ "property_id": "41-e-173rd-st", "property_address": "41** E 173rd St, Cleveland, OH 44128",
  "request_type": "Request info | Schedule a showing | Make an offer",
  "first_name": "", "last_name": "", "email": "", "phone": "", "company": "",
  "offer_price": "", "financing": "Cash | Hard money | Other | \"\"", "message": "",
  "form_name": "property-inquiry", "page_url": "...", "submitted_at": "2026-09-23T21:55:10.822Z", "source": "cledispo.com" }

// form_name: "buyers-list"
{ "first_name": "", "last_name": "", "email": "", "phone": "", "company": "",
  "areas": "44105, Euclid", "property_types": ["Single family", "Multi-family (5+ units)"],
  "price_min": "50k", "price_max": "200000", "financing": "Cash | Hard money | Other",
  "deals_per_year": "Just getting started | 1-2 | 3-5 | 6-10 | 11-25 | 25+", "notes": "",
  "consent": true, "consent_text": "By submitting, you agree to receive texts and emails from Right Price Home Buyers about properties. Message/data rates may apply. Reply STOP to opt out.",
  "form_name": "buyers-list", "page_url": "...", "submitted_at": "...", "source": "cledispo.com" }

// form_name: "contact"
{ "first_name": "", "last_name": "", "email": "", "phone": "", "company": "", "message": "",
  "form_name": "contact", "page_url": "...", "submitted_at": "...", "source": "cledispo.com" }
```

Form rules:

- Required fields are checked in the browser.
- Emails must look real, and phone numbers must be 10-digit US numbers.
- On the buyers list, min price can't be above max price.
- The text/email consent box is required only when a phone number is given.
- A hidden "honeypot" field catches spam bots. When a bot fills it in, the bot is sent to the thank-you page and nothing is delivered.
- If the endpoint fails, the visitor sees an error with the phone number and can try again.

## Checking the site locally

```sh
npx --yes http-server C:\RPHB\code\websites\cledispo -p 8082 -s
node C:\RPHB\code\websites\cledispo\_dev\crawl.js http://localhost:8082/
```

The checker crawls every page and reports missing pages, broken images and any leftover ReSimpli or WordPress links. It also tests the CSV reader against `data/listings.csv` and `_dev/test-listings.csv`.
