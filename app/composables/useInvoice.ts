import { get as idbGet, set as idbSet } from 'idb-keyval'

export interface InvoiceItem {
  id: string
  description: string
  qty: number
  rate: number
  taxRate: number
}

export interface InvoiceState {
  business: {
    name: string
    address: string
    email: string
    phone: string
    taxLabel: string
    taxId: string
    logo: string | null
  }
  client: {
    name: string
    address: string
    email: string
    taxId: string
  }
  meta: {
    prefix: string
    number: number
    issueDate: string
    dueDate: string
    taxPointDate: string
    currency: string
    taxInvoiceLabel: boolean
  }
  items: InvoiceItem[]
  tax: {
    enabled: boolean
    inclusive: boolean
    label: string
    defaultRate: number
  }
  discount: {
    type: 'none' | 'percent' | 'fixed'
    value: number
  }
  notes: string
  paymentTerms: string
  template: 'classic' | 'minimal'
  docLang: DocLang
}

export type DocLang = 'en' | 'fr' | 'es'

export interface SavedClient {
  name: string
  address: string
  email: string
  taxId: string
}

function today(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export function newItem(): InvoiceItem {
  return { id: Math.random().toString(36).slice(2), description: '', qty: 1, rate: 0, taxRate: 20 }
}

export const defaultInvoice = (): InvoiceState => ({
  business: { name: '', address: '', email: '', phone: '', taxLabel: 'VAT No', taxId: '', logo: null },
  client: { name: '', address: '', email: '', taxId: '' },
  meta: {
    prefix: 'INV-',
    number: 1,
    issueDate: today(),
    dueDate: today(30),
    taxPointDate: '',
    currency: 'USD',
    taxInvoiceLabel: false,
  },
  items: [newItem()],
  tax: { enabled: false, inclusive: false, label: 'VAT', defaultRate: 20 },
  discount: { type: 'none', value: 0 },
  notes: '',
  paymentTerms: '',
  template: 'classic',
  docLang: 'en',
})

export interface TaxBreakdownRow {
  rate: number
  base: number
  amount: number
}

export interface InvoiceTotals {
  subtotal: number
  discount: number
  taxRows: TaxBreakdownRow[]
  taxTotal: number
  total: number
}

/**
 * Money math. With `inclusive`, entered rates already contain tax:
 * the tax shown is extracted (rate/(100+rate)) and the total equals the
 * discounted subtotal.
 */
export function computeTotals(state: InvoiceState): InvoiceTotals {
  const round = (n: number) => Math.round(n * 100) / 100
  const subtotal = round(state.items.reduce((n, it) => n + (it.qty || 0) * (it.rate || 0), 0))
  let discount = 0
  if (state.discount.type === 'percent') discount = round(subtotal * (state.discount.value || 0) / 100)
  if (state.discount.type === 'fixed') discount = round(Math.min(state.discount.value || 0, subtotal))
  const discountFactor = subtotal > 0 ? (subtotal - discount) / subtotal : 1

  const byRate = new Map<number, number>()
  if (state.tax.enabled) {
    for (const it of state.items) {
      const base = round((it.qty || 0) * (it.rate || 0) * discountFactor)
      const rate = it.taxRate || 0
      if (rate > 0) byRate.set(rate, round((byRate.get(rate) || 0) + base))
    }
  }
  const taxRows: TaxBreakdownRow[] = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, base]) => ({
      rate,
      base,
      amount: round(state.tax.inclusive ? base * rate / (100 + rate) : base * rate / 100),
    }))
  const taxTotal = round(taxRows.reduce((n, r) => n + r.amount, 0))
  const afterDiscount = round(subtotal - discount)
  const total = state.tax.inclusive ? afterDiscount : round(afterDiscount + taxTotal)
  return { subtotal, discount, taxRows, taxTotal, total }
}

export function formatMoney(amount: number, currency: string, locale = 'en'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  }
  catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function formatDate(iso: string, locale = 'en'): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${iso}T00:00:00`))
  }
  catch {
    return iso
  }
}

export function invoiceNumber(state: InvoiceState): string {
  return `${state.meta.prefix}${String(state.meta.number).padStart(4, '0')}`
}

const STATE_KEY = 'invoice-state'
const CLIENTS_KEY = 'invoice-clients'

export function useInvoice() {
  const state = useState<InvoiceState>('invoice', defaultInvoice)
  const clients = useState<SavedClient[]>('invoice-clients', () => [])
  const totals = computed(() => computeTotals(state.value))
  const loaded = useState('invoice-loaded', () => false)

  // IndexedDB, not localStorage: Safari wipes script-writable storage after
  // 7 idle days either way, so backups below are the durable record.
  async function restore() {
    if (loaded.value || import.meta.server) return
    const [savedState, savedClients] = await Promise.all([idbGet(STATE_KEY), idbGet(CLIENTS_KEY)])
    if (savedState) state.value = { ...defaultInvoice(), ...savedState }
    if (savedClients) clients.value = savedClients
    loaded.value = true
  }

  const persist = useDebounceFn(async () => {
    if (import.meta.server) return
    await idbSet(STATE_KEY, JSON.parse(JSON.stringify(state.value)))
    await idbSet(CLIENTS_KEY, JSON.parse(JSON.stringify(clients.value)))
  }, 400)

  function saveClient() {
    const c = state.value.client
    if (!c.name.trim()) return
    clients.value = [
      { ...c },
      ...clients.value.filter(x => x.name !== c.name),
    ].slice(0, 50)
    persist()
  }

  function loadClient(c: SavedClient) {
    state.value.client = { ...c }
  }

  function exportBackup() {
    const blob = new Blob(
      [JSON.stringify({ version: 1, state: state.value, clients: clients.value }, null, 2)],
      { type: 'application/json' },
    )
    saveBlob(blob, 'snuuy-invoice-backup.json')
  }

  async function importBackup(file: File): Promise<boolean> {
    try {
      const data = JSON.parse(await file.text())
      if (!data.state) return false
      state.value = { ...defaultInvoice(), ...data.state }
      if (Array.isArray(data.clients)) clients.value = data.clients
      persist()
      return true
    }
    catch {
      return false
    }
  }

  return { state, clients, totals, restore, persist, saveClient, loadClient, exportBackup, importBackup }
}
