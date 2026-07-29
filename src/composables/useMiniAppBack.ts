import { useRouter } from 'vue-router'

/** 小程序二级页返回：有 miniapp 历史则 back，否则回工作台 */
export function useMiniAppBack(fallback = '/miniapp/workbench') {
  const router = useRouter()

  function goBack() {
    const back = window.history.state?.back as string | undefined
    if (back && back.startsWith('/miniapp')) {
      router.back()
      return
    }
    router.replace(fallback)
  }

  return { goBack }
}
