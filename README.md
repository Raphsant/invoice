# Snuuy Invoice

Fill in an invoice, download the PDF, done. Always free. No database, no accounts, and we never see what you type.

Plenty of invoice sites let you build the whole thing and then ask for a signup or a subscription before you can download it without a watermark across the middle. Some quietly lock you out of invoices you already made once you stop paying. This one is a client-side invoice generator: it runs in your browser and writes the PDF on your machine, so there's nothing to lock and nobody to bill.

Live at [invoice.snuuy.com](https://invoice.snuuy.com).

## What it does

- One form: your details, the client, line items, tax, discount, notes
- Invoice numbers that count up on their own (INV-0007, INV-0008, and so on) with a prefix you choose
- Tax handled properly — VAT, GST, sales tax, whatever you call it — shown per rate, added on top or already baked into the price
- Your logo, a list of saved clients, and a currency picker
- A live preview that is the exact PDF you'll download, not an approximation of it
- Two layouts, classic and minimal
- English, French, and Spanish. The invoice itself can be in a different language than the app, so you can bill a French client while working in English

Saved clients and your business details stay in your browser (IndexedDB). There's a one-click backup to a JSON file you can keep or move to another machine, since browser storage isn't permanent.

## Built with

Nuxt 4 and Nuxt UI, pdf-lib for the PDF, pdfjs-dist for the live preview, idb-keyval for local storage, and @nuxtjs/i18n for the three languages.

## Running it locally

Node 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Self-hosting

Push to GitHub, let the Actions workflow build and push the image to GHCR, set your image name in `compose.yaml`, and run it under Dockge or `docker compose`. Port 3000 inside the container.

## The rest of Snuuy

- [QRMaker](https://qr.snuuy.com) — styled QR codes
- [PDFTools](https://pdf.snuuy.com) — merge, split, and convert PDFs

Same rule across all of them: it runs on your device, it's free, and your data stays with you.
