import { computed } from 'vue'
import { useRoute } from 'vue-router'

export type PortalType = 'platform' | 'enterprise' | 'miniapp' | 'enterprise-miniapp'

export function usePortal() {
  const route = useRoute()

  const portal = computed<PortalType>(() => {
    if (route.path.startsWith('/enterprise-miniapp')) return 'enterprise-miniapp'
    if (route.path.startsWith('/miniapp')) return 'miniapp'
    if (route.path.startsWith('/enterprise')) return 'enterprise'
    return 'platform'
  })

  const isPlatform = computed(() => portal.value === 'platform')
  const isEnterprise = computed(() => portal.value === 'enterprise')
  const isMiniApp = computed(() => portal.value === 'miniapp')
  const isEnterpriseMiniApp = computed(() => portal.value === 'enterprise-miniapp')

  const pathPrefix = computed(() => (isEnterprise.value ? '/enterprise' : ''))

  function portalPath(path: string) {
    if (isEnterprise.value) {
      return path.startsWith('/enterprise') ? path : `/enterprise${path}`
    }
    return path.startsWith('/enterprise') ? path.replace(/^\/enterprise/, '') || '/' : path
  }

  return {
    portal,
    isPlatform,
    isEnterprise,
    isMiniApp,
    isEnterpriseMiniApp,
    pathPrefix,
    portalPath,
  }
}
