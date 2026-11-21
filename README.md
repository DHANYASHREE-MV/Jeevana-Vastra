# Jeevana Vastra: Premium Ethnic Wear Store with AI Virtual Try-On

A full-stack e-commerce site for Jeevana Vastra, built from the brand's own product photographs.

## Run it

Requires **Node.js 22.13+** (uses the built-in `node:sqlite`, so no native builds).

```bash
npm install
npm start            # http://localhost:3000
```

Optional: copy `.env.example` to `.env` and add an AI key for photoreal cloud try-on.

## What's inside

| Area | Details |
|---|---|
| Storefront | Hero carousel, category tiles, new-arrivals rail, bestseller/trending tabs, seasonal banners, collection film, testimonials, footer |
| Catalogue | 43 products from the uploaded photos (29 sarees, 9 kurta sets, 2 kurtis, 2 anarkalis, 1 co-ord). Prices follow the JV Price ranges in the stock sheets |
| Shopping | Filters (category, price, colour, size, availability), sorting, search with live suggestions, quick view, wishlist, bag with quantities, coupons (`VASTRA10`, `FIRST200`), free-shipping meter |
| Accounts | Register/login (scrypt hashes, HttpOnly session cookies), profile, password change, address book, order history, order tracking timeline, cancellation before dispatch. Guest bag and wishlist merge on login |
| Checkout | Address selection, UPI / card / COD. Online payment is **simulated**: plug in Razorpay/Stripe in `server/routes/shop.js` → `/checkout` |
| SEO | Server-rendered `<title>`/description/OpenGraph per route, Product JSON-LD, `sitemap.xml`, `robots.txt`, WebP images, lazy loading |

## Virtual Try-On (`/virtual-try-on`)

Choose any catalogue garment, then upload a photo or use the camera. Switching garments reuses the photo. The studio offers a before/after slider, download (with brand caption), saved looks, and links to the product page or bag. The exact catalogue photo of the selected garment is what the AI uses.

Two engines:

1. **Instant: on-device AI** (always available, no key, photo never leaves the browser):
   `public/js/tryon/local-engine.js`. MediaPipe pose detection runs on both the customer and the catalogue photo. Multiclass segmentation cuts out the garment, with morphological hole-closing and pull-push colour fill. A body-aligned triangle mesh (shoulders → hips → knees → ankles → hem) is affine-warped onto the customer. Scene-lighting modulation is applied, then face, hair and hands are re-layered on top. Each stage is a separate function, so it can be upgraded (dense pose, cloth simulation, diffusion refiner) without touching the UI.
   Limits: the customer's own clothing can show at the edges, and flat-lay photos need either the cloud engine or an approved mannequin view.
2. **Photoreal: cloud AI** (`server/tryon/`). Pluggable providers, tried in order, with automatic fallback:
   - `GEMINI_API_KEY`: Google Gemini image model. The only one that drapes **sarees**.
   - `FASHN_API_KEY`: FASHN dedicated try-on API (kurtas, sets).
   - `REPLICATE_API_TOKEN`: IDM-VTON on Replicate (kurtas, sets).
   Customer photos are processed in memory and never written to disk. Requests are rate-limited.

## Product images and mannequin presentation

`npm run images -- . "<photo folder A>" "<photo folder B>"` rebuilds every product image into a consistent 3:4 ivory catalogue frame (480 px and 1080 px WebP):
- Studio photos on plain black/white/green backdrops get the backdrop replaced with brand ivory. Only background pixels change; garment pixels are untouched.
- Scene photos are centre-cropped without distortion.
- The untouched original is kept as the try-on garment reference.

**AI mannequin views for every item** (needs `GEMINI_API_KEY` in `.env`, which stays on your machine and is never published):

```bash
npm run mannequin                          # drafts for all items → server/data/mannequin/review/
#   open server/data/mannequin/review/index.html to compare original vs draft
npm run mannequin -- --approve <slug> ...  # or --approve-all once you're happy
npm run images -- . "<photo folder A>" "<photo folder B>"   # approved views become photo #1
```

Drafts are never published automatically. Generative models can drift on colours, motifs and borders, so each one needs a human check against the original. The original photo stays in the gallery as image 2, the try-on keeps using real model photos, and flat-lays switch to their mannequin view (which makes them try-on-able on-device).

Back views: the source photos only show fronts (the Jamuni set has two angles), so no back views exist yet. Add photos to `server/data/catalog.json` → `src` and re-run `npm run images`.

## GitHub Pages (static build)

GitHub Pages can't run the Node server, so `npm run build:static` makes a browser-only copy in `dist/`:
- The catalogue is baked into `data/catalog.json`.
- Bag, wishlist, demo accounts and orders are kept in the visitor's browser (`public/js/static-backend.js`).
- Virtual Try-On uses the on-device engine.

```bash
npm run build:static -- --base Jeevana-Vastra --site https://dhanyashree-mv.github.io/Jeevana-Vastra
npm run preview:static -- Jeevana-Vastra     # test at http://localhost:4000/Jeevana-Vastra/
```

Publish `dist/` to the `gh-pages` branch. Deep links work through `404.html`.

Live site: https://dhanyashree-mv.github.io/Jeevana-Vastra/

## Structure

```
server/            Express API
  db.js            SQLite schema + catalogue seeding (from data/catalog.json)
  auth.js          sessions, hashing, guest identity, rate limiting
  routes/          catalog.js · shop.js (cart, wishlist, checkout, orders) · account.js
  tryon/           provider router + gemini / fashn / replicate adapters
public/            SPA (vanilla ES modules, no build step)
  js/app.js        router, header, search, drawer
  js/pages/        home · shop · product · bag · checkout · account · order · wishlist · tryon
  js/tryon/        on-device try-on engine
scripts/           process_images.py · mannequin.js
```

Delete `server/data/jeevana.db` to reset demo data (stock, users, orders).
