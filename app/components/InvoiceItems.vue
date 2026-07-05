<script setup lang="ts">
const { state, totals } = useInvoice()

function addItem() {
  const item = newItem()
  item.taxRate = state.value.tax.defaultRate
  state.value.items.push(item)
}

function removeItem(id: string) {
  if (state.value.items.length === 1) return
  state.value.items = state.value.items.filter(i => i.id !== id)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="(item, index) in state.items"
      :key="item.id"
      class="flex flex-col gap-2 rounded-lg border border-default p-3"
    >
      <div class="flex items-start gap-2">
        <UTextarea
          v-model="item.description"
          :rows="1"
          autoresize
          class="flex-1"
          :placeholder="`Item ${index + 1} — what did you do?`"
          autocomplete="off"
        />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="state.items.length === 1"
          :aria-label="`Remove item ${index + 1}`"
          @click="removeItem(item.id)"
        />
      </div>
      <div class="grid grid-cols-3 gap-2" :class="{ 'grid-cols-4': state.tax.enabled }">
        <UInput v-model.number="item.qty" type="number" min="0" step="any" autocomplete="off">
          <template #leading>
            <span class="text-xs text-muted">Qty</span>
          </template>
        </UInput>
        <UInput v-model.number="item.rate" type="number" min="0" step="any" autocomplete="off">
          <template #leading>
            <span class="text-xs text-muted">Rate</span>
          </template>
        </UInput>
        <UInput v-if="state.tax.enabled" v-model.number="item.taxRate" type="number" min="0" step="any" autocomplete="off">
          <template #leading>
            <span class="text-xs text-muted">Tax %</span>
          </template>
        </UInput>
        <div class="flex items-center justify-end pe-1 text-sm font-medium text-highlighted">
          {{ formatMoney((item.qty || 0) * (item.rate || 0), state.meta.currency) }}
        </div>
      </div>
    </div>

    <UButton
      label="Add item"
      icon="i-lucide-plus"
      color="neutral"
      variant="subtle"
      class="self-start"
      @click="addItem"
    />

    <p class="text-end text-sm text-muted">
      Subtotal <span class="font-medium text-highlighted">{{ formatMoney(totals.subtotal, state.meta.currency) }}</span>
    </p>
  </div>
</template>
