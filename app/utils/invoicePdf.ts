import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { DocLang, InvoiceState } from '~/composables/useInvoice'
import { computeTotals, formatDate, formatMoney, invoiceNumber } from '~/composables/useInvoice'

// Document strings live here (not in the UI i18n files): the invoice's language
// is chosen per document and is independent of the UI locale.
const DOC_STRINGS: Record<DocLang, Record<string, string>> = {
  en: {
    invoice: 'INVOICE',
    taxInvoice: 'TAX INVOICE',
    billTo: 'BILL TO',
    invoiceNo: 'Invoice no.',
    issueDate: 'Issue date',
    dueDate: 'Due date',
    taxPoint: 'Tax point',
    clientTaxId: 'Tax ID',
    description: 'DESCRIPTION',
    qty: 'QTY',
    rate: 'RATE',
    tax: 'TAX',
    amount: 'AMOUNT',
    subtotal: 'Subtotal',
    discount: 'Discount',
    included: '(included)',
    total: 'Total',
    totalIncl: 'Total (incl. {label})',
    paymentTerms: 'PAYMENT TERMS',
    notes: 'NOTES',
  },
  fr: {
    invoice: 'FACTURE',
    taxInvoice: 'FACTURE FISCALE',
    billTo: 'FACTURÉ À',
    invoiceNo: 'Facture n°',
    issueDate: 'Date d\'émission',
    dueDate: 'Date d\'échéance',
    taxPoint: 'Date de prestation',
    clientTaxId: 'N° fiscal',
    description: 'DESCRIPTION',
    qty: 'QTÉ',
    rate: 'PRIX',
    tax: 'TAXE',
    amount: 'MONTANT',
    subtotal: 'Sous-total',
    discount: 'Remise',
    included: '(incluse)',
    total: 'Total',
    totalIncl: 'Total ({label} incluse)',
    paymentTerms: 'CONDITIONS DE PAIEMENT',
    notes: 'NOTES',
  },
  es: {
    invoice: 'FACTURA',
    taxInvoice: 'FACTURA FISCAL',
    billTo: 'FACTURAR A',
    invoiceNo: 'Factura n.º',
    issueDate: 'Fecha de emisión',
    dueDate: 'Fecha de vencimiento',
    taxPoint: 'Fecha de operación',
    clientTaxId: 'NIF',
    description: 'DESCRIPCIÓN',
    qty: 'CANT.',
    rate: 'PRECIO',
    tax: 'IMP.',
    amount: 'IMPORTE',
    subtotal: 'Subtotal',
    discount: 'Descuento',
    included: '(incluido)',
    total: 'Total',
    totalIncl: 'Total ({label} incluido)',
    paymentTerms: 'CONDICIONES DE PAGO',
    notes: 'NOTAS',
  },
}

const A4 = { width: 595.28, height: 841.89 }
const MARGIN = 48
const ACCENT = rgb(0.23, 0.51, 0.96) // blue-500
const INK = rgb(0.09, 0.09, 0.11)
const MUTED = rgb(0.44, 0.44, 0.48)
const RULE = rgb(0.89, 0.89, 0.91)

// Helvetica is WinAnsi-encoded — strip anything it can't draw (emoji, CJK),
// but keep the currency/punctuation symbols WinAnsi does have.
function sanitize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[‘’]/g, '\'')
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ | /g, ' ')
    .replace(/[^\x20-\x7E\xA1-\xFF€]/g, '')
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const raw of sanitize(text).split('\n')) {
    let line = ''
    for (const word of raw.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate
      }
      else {
        if (line) lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines.length ? lines : ['']
}

export async function buildInvoicePdf(state: InvoiceState): Promise<Blob> {
  const totals = computeTotals(state)
  const L = DOC_STRINGS[state.docLang] ?? DOC_STRINGS.en
  const money = (n: number) => sanitize(formatMoney(n, state.meta.currency, state.docLang))
  const date = (iso: string) => sanitize(formatDate(iso, state.docLang))
  const minimal = state.template === 'minimal'

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([A4.width, A4.height])
  let y = A4.height - MARGIN

  const text = (str: string, x: number, yy: number, opts: { size?: number, font?: PDFFont, color?: ReturnType<typeof rgb>, right?: number } = {}) => {
    const f = opts.font ?? font
    const size = opts.size ?? 9.5
    const s = sanitize(str)
    const x2 = opts.right !== undefined ? opts.right - f.widthOfTextAtSize(s, size) : x
    page.drawText(s, { x: x2, y: yy, size, font: f, color: opts.color ?? INK })
  }
  const rule = (yy: number, color = RULE, thickness = 0.75) =>
    page.drawLine({ start: { x: MARGIN, y: yy }, end: { x: A4.width - MARGIN, y: yy }, color, thickness })

  // ----- header: logo + business (left), title + meta (right)
  const headerTop = y
  let leftY = y
  if (state.business.logo) {
    try {
      const bytes = Uint8Array.from(atob(state.business.logo.split(',')[1]!), c => c.charCodeAt(0))
      const img = state.business.logo.startsWith('data:image/png')
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes)
      const h = 36
      const w = (img.width / img.height) * h
      page.drawImage(img, { x: MARGIN, y: leftY - h, width: Math.min(w, 160), height: h })
      leftY -= h + 12
    }
    catch { /* bad image data — skip the logo rather than fail the build */ }
  }
  if (state.business.name) {
    text(state.business.name, MARGIN, leftY - 11, { font: bold, size: 11 })
    leftY -= 16
  }
  const bizLines = [
    ...wrapText(font, state.business.address, 8.5, 220),
    state.business.email,
    state.business.phone,
    state.business.taxId ? `${state.business.taxLabel} ${state.business.taxId}` : '',
  ].filter(Boolean)
  for (const line of bizLines) {
    text(line, MARGIN, leftY - 9, { size: 8.5, color: MUTED })
    leftY -= 12
  }

  const title = state.meta.taxInvoiceLabel ? L.taxInvoice! : L.invoice!
  text(title, 0, headerTop - 18, { font: bold, size: 21, color: minimal ? INK : ACCENT, right: A4.width - MARGIN })
  let rightY = headerTop - 40
  const metaRow = (label: string, value: string) => {
    text(label, 0, rightY, { size: 8.5, color: MUTED, right: A4.width - MARGIN - 92 })
    text(value, 0, rightY, { size: 8.5, font: bold, right: A4.width - MARGIN })
    rightY -= 13
  }
  metaRow(L.invoiceNo!, invoiceNumber(state))
  metaRow(L.issueDate!, date(state.meta.issueDate))
  if (state.meta.dueDate) metaRow(L.dueDate!, date(state.meta.dueDate))
  if (state.meta.taxPointDate) metaRow(L.taxPoint!, date(state.meta.taxPointDate))

  y = Math.min(leftY, rightY) - 24

  // ----- bill to
  text(L.billTo!, MARGIN, y, { size: 7.5, font: bold, color: MUTED })
  y -= 14
  if (state.client.name) {
    text(state.client.name, MARGIN, y, { font: bold, size: 10 })
    y -= 14
  }
  const clientLines = [
    ...wrapText(font, state.client.address, 8.5, 260),
    state.client.email,
    state.client.taxId ? `${L.clientTaxId} ${state.client.taxId}` : '',
  ].filter(Boolean)
  for (const line of clientLines) {
    text(line, MARGIN, y, { size: 8.5, color: MUTED })
    y -= 12
  }
  y -= 18

  // ----- items table
  const showTax = state.tax.enabled
  const col = {
    desc: MARGIN + (minimal ? 0 : 10),
    qty: 350,
    rate: 430,
    tax: 470,
    amount: A4.width - MARGIN - (minimal ? 0 : 10),
  }
  const descWidth = col.qty - col.desc - 60

  const tableHeader = () => {
    if (!minimal) {
      page.drawRectangle({ x: MARGIN, y: y - 6, width: A4.width - MARGIN * 2, height: 20, color: ACCENT })
    }
    const hc = minimal ? MUTED : rgb(1, 1, 1)
    const hy = y
    text(L.description!, col.desc, hy, { size: 7.5, font: bold, color: hc })
    text(L.qty!, 0, hy, { size: 7.5, font: bold, color: hc, right: col.qty })
    text(L.rate!, 0, hy, { size: 7.5, font: bold, color: hc, right: col.rate })
    if (showTax) text(L.tax!, 0, hy, { size: 7.5, font: bold, color: hc, right: col.tax })
    text(L.amount!, 0, hy, { size: 7.5, font: bold, color: hc, right: col.amount })
    y -= minimal ? 14 : 24
    if (minimal) {
      rule(y + 6, INK, 1)
      y -= 4
    }
  }

  const newPage = () => {
    page = doc.addPage([A4.width, A4.height])
    y = A4.height - MARGIN
    tableHeader()
  }

  tableHeader()
  for (const item of state.items) {
    const lines = wrapText(font, item.description || '—', 9, descWidth)
    const rowHeight = Math.max(lines.length * 12, 16)
    if (y - rowHeight < 150) newPage()
    const rowTop = y
    lines.forEach((line, i) => text(line, col.desc, rowTop - i * 12, { size: 9 }))
    text(String(item.qty || 0), 0, rowTop, { size: 9, right: col.qty })
    text(money(item.rate || 0), 0, rowTop, { size: 9, right: col.rate })
    if (showTax) text(`${item.taxRate || 0}%`, 0, rowTop, { size: 9, right: col.tax, color: MUTED })
    text(money((item.qty || 0) * (item.rate || 0)), 0, rowTop, { size: 9, right: col.amount })
    y -= rowHeight + 6
    rule(y + 10)
  }

  // ----- totals
  if (y < 200) newPage()
  y -= 8
  const totalRow = (label: string, value: string, opts: { bold?: boolean, accent?: boolean } = {}) => {
    text(label, 0, y, { size: opts.bold ? 10.5 : 9, font: opts.bold ? bold : font, color: opts.bold ? INK : MUTED, right: col.amount - 110 })
    text(value, 0, y, { size: opts.bold ? 10.5 : 9, font: opts.bold ? bold : font, color: opts.accent ? ACCENT : INK, right: col.amount })
    y -= opts.bold ? 20 : 15
  }
  totalRow(L.subtotal!, money(totals.subtotal))
  if (totals.discount > 0) {
    totalRow(
      state.discount.type === 'percent' ? `${L.discount} (${state.discount.value}%)` : L.discount!,
      `-${money(totals.discount)}`,
    )
  }
  for (const row of totals.taxRows) {
    totalRow(`${state.tax.label} ${row.rate}%${state.tax.inclusive ? ` ${L.included}` : ''}`, money(row.amount))
  }
  page.drawLine({ start: { x: col.amount - 190, y: y + 8 }, end: { x: col.amount, y: y + 8 }, color: minimal ? INK : ACCENT, thickness: 1.25 })
  y -= 6
  totalRow(
    state.tax.inclusive && totals.taxTotal > 0 ? L.totalIncl!.replace('{label}', state.tax.label) : L.total!,
    money(totals.total),
    { bold: true, accent: !minimal },
  )

  // ----- notes / terms
  const footerBlock = (label: string, body: string) => {
    if (!body.trim()) return
    if (y < 110) newPage()
    y -= 10
    text(label, MARGIN, y, { size: 7.5, font: bold, color: MUTED })
    y -= 13
    for (const line of wrapText(font, body, 8.5, A4.width - MARGIN * 2)) {
      text(line, MARGIN, y, { size: 8.5, color: INK })
      y -= 12
    }
  }
  footerBlock(L.paymentTerms!, state.paymentTerms)
  footerBlock(L.notes!, state.notes)

  return new Blob([await doc.save()], { type: 'application/pdf' })
}
