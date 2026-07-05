<script setup lang="ts">
const siteUrl = useRuntimeConfig().public.siteUrl

useSeoMeta({
  title: 'Free invoice generator — no sign-up, no watermark | Snuuy Invoice',
  description: 'Create professional invoices in your browser: VAT/GST support, logo, sequential numbering, PDF download. Unlimited and free forever — your data never leaves your device.',
  ogTitle: 'Snuuy Invoice — free invoice generator, no sign-up',
  ogDescription: 'Unlimited professional invoices with VAT/GST support, generated on your device. No account, no watermark, no paywall.',
  ogType: 'website',
  ogUrl: `${siteUrl}/`,
  ogImage: `${siteUrl}/og.png`,
  twitterCard: 'summary_large_image',
  twitterTitle: 'Snuuy Invoice — free invoice generator, no sign-up',
  twitterImage: `${siteUrl}/og.png`,
})

useHead({ link: [{ rel: 'canonical', href: `${siteUrl}/` }] })

const toast = useToast()
const { recordExport } = useTipJar()
const { state, clients, totals, restore, persist, saveClient, loadClient, exportBackup, importBackup } = useInvoice()

const downloading = ref(false)
const previewOpen = ref(false)
const logoInput = ref<HTMLInputElement>()
const backupInput = ref<HTMLInputElement>()

onMounted(async () => {
  await restore()
  watch([state, clients], () => persist(), { deep: true })
})

const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK', 'JPY', 'INR']
const taxLabels = ['VAT', 'GST', 'Sales tax', 'HST', 'Tax']

function setTerms(days: number) {
  const d = new Date(state.value.meta.issueDate || new Date().toISOString().slice(0, 10))
  d.setDate(d.getDate() + days)
  state.value.meta.dueDate = d.toISOString().slice(0, 10)
}

function onLogoPicked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    state.value.business.logo = reader.result as string
  }
  reader.readAsDataURL(file)
  ;(event.target as HTMLInputElement).value = ''
}

async function onBackupPicked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const ok = await importBackup(file)
  toast.add(ok
    ? { title: 'Backup restored', icon: 'i-lucide-circle-check', color: 'success', duration: 2500 }
    : { title: 'That file isn\'t a Snuuy Invoice backup', icon: 'i-lucide-triangle-alert', color: 'error' })
  ;(event.target as HTMLInputElement).value = ''
}

function applyDefaultTaxRate() {
  for (const item of state.value.items) item.taxRate = state.value.tax.defaultRate
}

async function download() {
  if (downloading.value) return
  downloading.value = true
  try {
    const number = invoiceNumber(state.value)
    saveBlob(await buildInvoicePdf(state.value), `${number}.pdf`)
    state.value.meta.number++
    persist()
    toast.add({ title: `${number}.pdf saved — next is #${String(state.value.meta.number).padStart(4, '0')}`, icon: 'i-lucide-circle-check', color: 'success', duration: 3000 })
    recordExport()
  }
  catch {
    toast.add({ title: 'Something went wrong building the PDF', icon: 'i-lucide-triangle-alert', color: 'error' })
  }
  finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-default">
    <AppHeader>
      <template #actions>
        <UButton
          icon="i-lucide-download"
          label="Backup"
          color="neutral"
          variant="ghost"
          @click="exportBackup"
        />
        <UButton
          icon="i-lucide-upload"
          color="neutral"
          variant="ghost"
          aria-label="Restore backup"
          @click="backupInput?.click()"
        />
        <input ref="backupInput" type="file" accept="application/json,.json" class="hidden" @change="onBackupPicked">
      </template>
    </AppHeader>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 lg:py-10 lg:pb-10">
      <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_460px]">
        <div class="flex flex-col gap-8">
          <section class="flex flex-col gap-3">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted">
              Your business
            </h2>
            <div class="grid gap-2 sm:grid-cols-2">
              <UInput v-model="state.business.name" placeholder="Business or your name" autocomplete="organization" />
              <UInput v-model="state.business.email" placeholder="Email" type="email" autocomplete="email" />
            </div>
            <UTextarea v-model="state.business.address" :rows="2" autoresize placeholder="Address" />
            <div class="grid gap-2 sm:grid-cols-3">
              <UInput v-model="state.business.phone" placeholder="Phone (optional)" type="tel" />
              <UInput v-model="state.business.taxLabel" placeholder="Tax ID label (e.g. VAT No, ABN)" />
              <UInput v-model="state.business.taxId" placeholder="Tax ID (optional)" />
            </div>
            <div class="flex items-center gap-3">
              <input ref="logoInput" type="file" accept="image/png,image/jpeg" class="hidden" @change="onLogoPicked">
              <template v-if="state.business.logo">
                <img :src="state.business.logo" alt="Logo" class="h-9 rounded border border-default bg-white object-contain px-1">
                <UButton label="Replace" color="neutral" variant="subtle" size="sm" @click="logoInput?.click()" />
                <UButton label="Remove" color="neutral" variant="ghost" size="sm" @click="state.business.logo = null" />
              </template>
              <UButton v-else label="Add logo" icon="i-lucide-image-plus" color="neutral" variant="subtle" size="sm" @click="logoInput?.click()" />
            </div>
          </section>

          <section class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h2 class="text-xs font-semibold uppercase tracking-wider text-muted">
                Bill to
              </h2>
              <div class="flex items-center gap-1">
                <USelectMenu
                  v-if="clients.length"
                  :items="clients.map(c => c.name)"
                  placeholder="Saved clients"
                  size="xs"
                  class="w-40"
                  @update:model-value="(name: string) => { const c = clients.find(x => x.name === name); if (c) loadClient(c) }"
                />
                <UButton
                  label="Save client"
                  icon="i-lucide-bookmark"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :disabled="!state.client.name.trim()"
                  @click="saveClient(); toast.add({ title: 'Client saved on this device', duration: 2000, icon: 'i-lucide-circle-check', color: 'success' })"
                />
              </div>
            </div>
            <div class="grid gap-2 sm:grid-cols-2">
              <UInput v-model="state.client.name" placeholder="Client name" />
              <UInput v-model="state.client.email" placeholder="Client email (optional)" type="email" />
            </div>
            <UTextarea v-model="state.client.address" :rows="2" autoresize placeholder="Client address" />
            <UInput v-model="state.client.taxId" placeholder="Client VAT/tax ID (optional — needed for EU B2B)" />
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted">
              Invoice details
            </h2>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <UInput v-model="state.meta.prefix" placeholder="Prefix">
                <template #leading>
                  <span class="text-xs text-muted">№</span>
                </template>
              </UInput>
              <UInput v-model.number="state.meta.number" type="number" min="1" />
              <UInput v-model="state.meta.issueDate" type="date" aria-label="Issue date" />
              <UInput v-model="state.meta.dueDate" type="date" aria-label="Due date" />
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-muted">Due in</span>
              <UButton v-for="d in [7, 14, 30]" :key="d" :label="`${d} days`" color="neutral" variant="subtle" size="xs" @click="setTerms(d)" />
              <span class="ms-auto flex items-center gap-2">
                <span class="text-xs text-muted">Currency</span>
                <USelectMenu v-model="state.meta.currency" :items="currencies" size="sm" class="w-24" />
              </span>
            </div>
            <USwitch v-model="state.meta.taxInvoiceLabel" label="Label as “TAX INVOICE” (required in Australia)" size="sm" />
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted">
              Items
            </h2>
            <InvoiceItems />
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted">
              Tax & discount
            </h2>
            <USwitch v-model="state.tax.enabled" :label="`Charge ${state.tax.label || 'tax'}`" size="sm" />
            <template v-if="state.tax.enabled">
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <USelectMenu v-model="state.tax.label" :items="taxLabels" create-item @create="(v: string) => state.tax.label = v" />
                <UInput v-model.number="state.tax.defaultRate" type="number" min="0" step="any">
                  <template #trailing>
                    <span class="text-xs text-muted">%</span>
                  </template>
                </UInput>
                <UButton label="Apply to all items" color="neutral" variant="subtle" size="sm" @click="applyDefaultTaxRate" />
              </div>
              <USwitch v-model="state.tax.inclusive" :label="`Prices already include ${state.tax.label}`" size="sm" />
            </template>
            <div class="grid grid-cols-2 gap-2 sm:w-1/2">
              <USelectMenu
                v-model="state.discount.type"
                :items="[{ label: 'No discount', value: 'none' }, { label: 'Percent off', value: 'percent' }, { label: 'Fixed amount', value: 'fixed' }]"
                value-key="value"
              />
              <UInput v-if="state.discount.type !== 'none'" v-model.number="state.discount.value" type="number" min="0" step="any">
                <template #trailing>
                  <span class="text-xs text-muted">{{ state.discount.type === 'percent' ? '%' : state.meta.currency }}</span>
                </template>
              </UInput>
            </div>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted">
              Payment terms & notes
            </h2>
            <UTextarea v-model="state.paymentTerms" :rows="2" autoresize placeholder="Payment terms — bank details, late fees… (optional)" />
            <UTextarea v-model="state.notes" :rows="2" autoresize placeholder="Notes — thank you message, references… (optional)" />
          </section>
        </div>

        <div class="hidden lg:block">
          <div class="sticky top-8 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div class="grid grid-cols-2 gap-1 rounded-lg border border-default p-1">
                <button
                  v-for="t in (['classic', 'minimal'] as const)"
                  :key="t"
                  type="button"
                  class="rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors"
                  :class="state.template === t ? 'bg-primary/10 text-primary' : 'text-muted hover:text-toned'"
                  @click="state.template = t"
                >
                  {{ t }}
                </button>
              </div>
              <p class="text-sm text-muted">
                Total <span class="font-semibold text-highlighted">{{ formatMoney(totals.total, state.meta.currency) }}</span>
              </p>
            </div>
            <div class="max-h-[70vh] overflow-y-auto rounded-lg">
              <InvoicePreview />
            </div>
            <UButton
              :label="`Download ${invoiceNumber(state)}.pdf`"
              icon="i-lucide-download"
              size="lg"
              block
              :loading="downloading"
              @click="download"
            />
          </div>
        </div>
      </div>
    </main>

    <div class="fixed inset-x-0 bottom-0 z-10 border-t border-default bg-default/95 backdrop-blur lg:hidden">
      <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <p class="text-sm text-muted">
          Total <span class="font-semibold text-highlighted">{{ formatMoney(totals.total, state.meta.currency) }}</span>
        </p>
        <UButton label="Preview & download" icon="i-lucide-eye" @click="previewOpen = true" />
      </div>
    </div>

    <USlideover v-model:open="previewOpen" title="Invoice preview" side="bottom">
      <template #body>
        <div class="flex flex-col gap-3">
          <InvoicePreview />
          <UButton
            :label="`Download ${invoiceNumber(state)}.pdf`"
            icon="i-lucide-download"
            size="lg"
            block
            :loading="downloading"
            @click="download"
          />
        </div>
      </template>
    </USlideover>

    <AppFooter />
  </div>
</template>
