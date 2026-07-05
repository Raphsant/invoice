<script setup lang="ts">
const { state } = useInvoice()

const container = ref<HTMLDivElement>()
let run = 0

async function render() {
  const my = ++run
  try {
    const blob = await buildInvoicePdf(state.value)
    if (my !== run) return
    const pdfjs = await import('pdfjs-dist')
    // @ts-expect-error vite ?url import has no type declaration
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const task = pdfjs.getDocument({ data: await blob.arrayBuffer() })
    const doc = await task.promise
    if (my !== run || !container.value) {
      await task.destroy()
      return
    }
    const canvases: HTMLCanvasElement[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const pdfPage = await doc.getPage(i)
      const viewport = pdfPage.getViewport({ scale: 1.6 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await pdfPage.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
      canvases.push(canvas)
    }
    await task.destroy()
    if (my !== run || !container.value) return
    container.value.replaceChildren(...canvases)
  }
  catch {
    // keep the last good preview on transient build errors
  }
}

const debouncedRender = useDebounceFn(render, 350)
watch(state, debouncedRender, { deep: true })
onMounted(render)
</script>

<template>
  <div
    ref="container"
    class="flex flex-col gap-3 [&>canvas]:w-full [&>canvas]:rounded-lg [&>canvas]:border [&>canvas]:border-default [&>canvas]:bg-white [&>canvas]:shadow-sm"
  />
</template>
