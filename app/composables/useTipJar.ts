export const TIP_URL = 'https://ko-fi.com/sunnysnuuy'

const ASK_AFTER_EXPORTS = 10

export function useTipJar() {
  const exports = useLocalStorage('invoice-export-count', 0)
  const asked = useLocalStorage('invoice-tip-asked', false)
  const toast = useToast()

  // One gentle ask after the Nth export, then never again.
  function recordExport() {
    exports.value++
    if (exports.value < ASK_AFTER_EXPORTS || asked.value) return
    asked.value = true
    toast.add({
      title: 'Enjoying Snuuy Invoice?',
      description: 'It’s free forever — tips keep it that way.',
      icon: 'i-lucide-coffee',
      duration: 10000,
      actions: [{
        label: 'Leave a tip',
        color: 'neutral',
        variant: 'outline',
        onClick: () => window.open(TIP_URL, '_blank', 'noopener'),
      }],
    })
  }

  return { recordExport }
}
