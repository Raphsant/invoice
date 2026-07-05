<script setup lang="ts">
import type { DocLang } from '~/composables/useInvoice'

const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
const route = useRoute()
const siteUrl = useRuntimeConfig().public.siteUrl

useSeoMeta({
  title: () => t('seo.title'),
  description: () => t('seo.description'),
  ogTitle: () => t('seo.ogTitle'),
  ogDescription: () => t('seo.ogDescription'),
  ogType: 'website',
  ogUrl: () => `${siteUrl}${route.path}`,
  ogImage: `${siteUrl}/og.png`,
  twitterCard: 'summary_large_image',
  twitterTitle: () => t('seo.ogTitle'),
  twitterImage: `${siteUrl}/og.png`,
})

useHead({
  link: [
    { rel: 'canonical', href: () => `${siteUrl}${route.path}` },
    { rel: 'alternate', hreflang: 'en', href: `${siteUrl}/` },
    { rel: 'alternate', hreflang: 'fr', href: `${siteUrl}/fr` },
    { rel: 'alternate', hreflang: 'es', href: `${siteUrl}/es` },
    { rel: 'alternate', hreflang: 'x-default', href: `${siteUrl}/` },
  ],
})

const toast = useToast()
const { recordExport } = useTipJar()
const { state, clients, totals, restore, persist, saveClient, loadClient, exportBackup, importBackup } = useInvoice()

const downloading = ref(false)
const previewOpen = ref(false)
const logoInput = ref<HTMLInputElement>()
const backupInput = ref<HTMLInputElement>()

onMounted(async () => {
  const fresh = !(await import('idb-keyval').then(m => m.get('invoice-state')))
  await restore()
  // fresh visitors get invoice documents in their UI language
  if (fresh && ['en', 'fr', 'es'].includes(locale.value)) state.value.docLang = locale.value as DocLang
  watch([state, clients], () => persist(), { deep: true })
})

const languageItems = computed(() =>
  locales.value.map(l => ({
    label: l.name!,
    onSelect: () => navigateTo(switchLocalePath(l.code)),
  })))

const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK', 'JPY', 'INR']
const taxLabels = ['VAT', 'TVA', 'IVA', 'GST', 'Sales tax', 'HST', 'Tax']
const docLangs: { value: DocLang, label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
]

const discountItems = computed(() => [
  { label: t('tax.noDiscount'), value: 'none' },
  { label: t('tax.percentOff'), value: 'percent' },
  { label: t('tax.fixedAmount'), value: 'fixed' },
])

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
    ? { title: t('toasts.backupRestored'), icon: 'i-lucide-circle-check', color: 'success', duration: 2500 }
    : { title: t('toasts.backupInvalid'), icon: 'i-lucide-triangle-alert', color: 'error' })
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
    toast.add({
      title: t('toasts.saved', { file: `${number}.pdf`, next: String(state.value.meta.number).padStart(4, '0') }),
      icon: 'i-lucide-circle-check',
      color: 'success',
      duration: 3000,
    })
    recordExport()
  }
  catch {
    toast.add({ title: t('toasts.buildError'), icon: 'i-lucide-triangle-alert', color: 'error' })
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
        <UDropdownMenu :items="languageItems">
          <UButton
            icon="i-lucide-globe"
            :label="locale.toUpperCase()"
            color="neutral"
            variant="ghost"
            :aria-label="t('header.language')"
          />
        </UDropdownMenu>
        <UButton
          icon="i-lucide-download"
          :label="t('header.backup')"
          color="neutral"
          variant="ghost"
          @click="exportBackup"
        />
        <UButton
          icon="i-lucide-upload"
          color="neutral"
          variant="ghost"
          :aria-label="t('header.restoreBackup')"
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
              {{ t('sections.business') }}
            </h2>
            <div class="grid gap-2 sm:grid-cols-2">
              <UInput v-model="state.business.name" :placeholder="t('business.name')" autocomplete="organization" />
              <UInput v-model="state.business.email" :placeholder="t('business.email')" type="email" autocomplete="email" />
            </div>
            <UTextarea v-model="state.business.address" :rows="2" autoresize :placeholder="t('business.address')" />
            <div class="grid gap-2 sm:grid-cols-3">
              <UInput v-model="state.business.phone" :placeholder="t('business.phone')" type="tel" />
              <UInput v-model="state.business.taxLabel" :placeholder="t('business.taxLabel')" />
              <UInput v-model="state.business.taxId" :placeholder="t('business.taxId')" />
            </div>
            <div class="flex items-center gap-3">
              <input ref="logoInput" type="file" accept="image/png,image/jpeg" class="hidden" @change="onLogoPicked">
              <template v-if="state.business.logo">
                <img :src="state.business.logo" alt="Logo" class="h-9 rounded border border-default bg-white object-contain px-1">
                <UButton :label="t('business.replace')" color="neutral" variant="subtle" size="sm" @click="logoInput?.click()" />
                <UButton :label="t('business.remove')" color="neutral" variant="ghost" size="sm" @click="state.business.logo = null" />
              </template>
              <UButton v-else :label="t('business.addLogo')" icon="i-lucide-image-plus" color="neutral" variant="subtle" size="sm" @click="logoInput?.click()" />
            </div>
          </section>

          <section class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h2 class="text-xs font-semibold uppercase tracking-wider text-muted">
                {{ t('sections.billTo') }}
              </h2>
              <div class="flex items-center gap-1">
                <USelectMenu
                  v-if="clients.length"
                  :items="clients.map(c => c.name)"
                  :placeholder="t('client.savedClients')"
                  size="xs"
                  class="w-40"
                  @update:model-value="(name: string) => { const c = clients.find(x => x.name === name); if (c) loadClient(c) }"
                />
                <UButton
                  :label="t('client.saveClient')"
                  icon="i-lucide-bookmark"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :disabled="!state.client.name.trim()"
                  @click="saveClient(); toast.add({ title: t('client.saved'), duration: 2000, icon: 'i-lucide-circle-check', color: 'success' })"
                />
              </div>
            </div>
            <div class="grid gap-2 sm:grid-cols-2">
              <UInput v-model="state.client.name" :placeholder="t('client.name')" />
              <UInput v-model="state.client.email" :placeholder="t('client.email')" type="email" />
            </div>
            <UTextarea v-model="state.client.address" :rows="2" autoresize :placeholder="t('client.address')" />
            <UInput v-model="state.client.taxId" :placeholder="t('client.taxId')" />
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted">
              {{ t('sections.details') }}
            </h2>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <UInput v-model="state.meta.prefix" :placeholder="t('details.prefix')">
                <template #leading>
                  <span class="text-xs text-muted">№</span>
                </template>
              </UInput>
              <UInput v-model.number="state.meta.number" type="number" min="1" />
              <UInput v-model="state.meta.issueDate" type="date" :aria-label="t('details.issueDate')" />
              <UInput v-model="state.meta.dueDate" type="date" :aria-label="t('details.dueDate')" />
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-muted">{{ t('details.dueIn') }}</span>
              <UButton v-for="d in [7, 14, 30]" :key="d" :label="t('details.days', { n: d })" color="neutral" variant="subtle" size="xs" @click="setTerms(d)" />
              <span class="ms-auto flex items-center gap-2">
                <span class="text-xs text-muted">{{ t('details.currency') }}</span>
                <USelectMenu v-model="state.meta.currency" :items="currencies" size="sm" class="w-24" />
              </span>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <USwitch v-model="state.meta.taxInvoiceLabel" :label="t('details.taxInvoiceLabel')" size="sm" />
              <span class="flex items-center gap-2">
                <span class="text-xs text-muted">{{ t('details.docLanguage') }}</span>
                <USelectMenu v-model="state.docLang" :items="docLangs" value-key="value" size="sm" class="w-32" />
              </span>
            </div>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted">
              {{ t('sections.items') }}
            </h2>
            <InvoiceItems />
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted">
              {{ t('sections.taxDiscount') }}
            </h2>
            <USwitch v-model="state.tax.enabled" :label="t('tax.charge', { label: state.tax.label || 'tax' })" size="sm" />
            <template v-if="state.tax.enabled">
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <USelectMenu v-model="state.tax.label" :items="taxLabels" create-item @create="(v: string) => state.tax.label = v" />
                <UInput v-model.number="state.tax.defaultRate" type="number" min="0" step="any">
                  <template #trailing>
                    <span class="text-xs text-muted">%</span>
                  </template>
                </UInput>
                <UButton :label="t('tax.applyAll')" color="neutral" variant="subtle" size="sm" @click="applyDefaultTaxRate" />
              </div>
              <USwitch v-model="state.tax.inclusive" :label="t('tax.inclusive', { label: state.tax.label })" size="sm" />
            </template>
            <div class="grid grid-cols-2 gap-2 sm:w-1/2">
              <USelectMenu
                v-model="state.discount.type"
                :items="discountItems"
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
              {{ t('sections.notes') }}
            </h2>
            <UTextarea v-model="state.paymentTerms" :rows="2" autoresize :placeholder="t('notes.paymentTerms')" />
            <UTextarea v-model="state.notes" :rows="2" autoresize :placeholder="t('notes.notes')" />
          </section>
        </div>

        <div class="hidden lg:block">
          <div class="sticky top-8 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div class="grid grid-cols-2 gap-1 rounded-lg border border-default p-1">
                <button
                  v-for="tmpl in (['classic', 'minimal'] as const)"
                  :key="tmpl"
                  type="button"
                  class="rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors"
                  :class="state.template === tmpl ? 'bg-primary/10 text-primary' : 'text-muted hover:text-toned'"
                  @click="state.template = tmpl"
                >
                  {{ tmpl }}
                </button>
              </div>
              <p class="text-sm text-muted">
                {{ t('preview.total') }} <span class="font-semibold text-highlighted">{{ formatMoney(totals.total, state.meta.currency, locale) }}</span>
              </p>
            </div>
            <div class="max-h-[70vh] overflow-y-auto rounded-lg">
              <InvoicePreview />
            </div>
            <UButton
              :label="t('preview.download', { file: `${invoiceNumber(state)}.pdf` })"
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
          {{ t('preview.total') }} <span class="font-semibold text-highlighted">{{ formatMoney(totals.total, state.meta.currency, locale) }}</span>
        </p>
        <UButton :label="t('preview.previewDownload')" icon="i-lucide-eye" @click="previewOpen = true" />
      </div>
    </div>

    <USlideover v-model:open="previewOpen" :title="t('preview.title')" side="bottom">
      <template #body>
        <div class="flex flex-col gap-3">
          <InvoicePreview />
          <UButton
            :label="t('preview.download', { file: `${invoiceNumber(state)}.pdf` })"
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
