# Kiddoo landing page

Static marketing site (French / Arabic): one `index.html` with inline CSS and JS, and its photos in `images/`.
It has no build step and does not depend on the app.

- **Deploy**: serve this folder as-is on any static host (Cloudflare Pages, Netlify, an Nginx root…).
- **WhatsApp number**: `WHATSAPP` and `WHATSAPP_DISPLAY` at the top of the main `<script>`.
- **Prices**: `PRICES` (monthly, in DA; yearly = 10 months) and the `plans` entries in the `fr` and `ar` copy.
- **App screenshots**: `images/app/<screen>-<fr|ar>.jpg`, captured from a demo school (fictitious data).
- **Photos**: `images/<slot>.jpg`; a slot without a file shows a placeholder.
