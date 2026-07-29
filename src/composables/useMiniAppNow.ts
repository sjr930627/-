import { onMounted, onUnmounted, ref } from 'vue'
import { MINIAPP_DEMO_ANCHOR_DATE } from '@/constants/miniapp'

/** Demo 小程序：固定 demo 日期 + 实时时分秒，与 seed 数据对齐 */
export function createMiniAppNow() {
  const real = new Date()
  const [y, m, d] = MINIAPP_DEMO_ANCHOR_DATE.split('-').map(Number)
  return new Date(y, m - 1, d, real.getHours(), real.getMinutes(), real.getSeconds())
}

export function useMiniAppNow() {
  const now = ref(createMiniAppNow())
  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    timer = setInterval(() => {
      now.value = createMiniAppNow()
    }, 1000)
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return { now }
}
