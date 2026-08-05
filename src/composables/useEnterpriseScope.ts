import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { normalizeEnterpriseId } from '@/utils/enterpriseScope'

/** switch: 必须选择单一企业（排班/考勤数据）；filter: 可全部企业（列表页） */
export function useEnterpriseScope(mode: 'switch' | 'filter' = 'filter') {
  const store = useAppStore()
  const route = useRoute()

  const isPlatform = computed(() => !route.path.startsWith('/enterprise'))

  const defaultEnterpriseId =
    store.enterprises.find((e) => e.status === 'active')?.id ?? store.currentEnterpriseId

  const enterpriseFilter = ref(mode === 'switch' ? defaultEnterpriseId : 'all')

  watch(
    () => store.currentEnterpriseId,
    (id) => {
      if (!isPlatform.value) enterpriseFilter.value = id
    },
  )

  const activeEnterpriseId = computed(() => {
    if (!isPlatform.value) return store.currentEnterpriseId
    if (mode === 'switch') return enterpriseFilter.value
    return enterpriseFilter.value === 'all' ? '' : enterpriseFilter.value
  })

  const enterpriseOptions = computed(() =>
    store.enterprises.filter((e) => e.status !== 'terminated'),
  )

  function enterpriseName(id?: string) {
    const entId = id ?? activeEnterpriseId.value
    if (!entId) return '-'
    return store.enterprises.find((e) => e.id === entId)?.name ?? '-'
  }

  function matchesEnterprise(entityEnterpriseId?: string) {
    const normalized = normalizeEnterpriseId(entityEnterpriseId)
    if (!isPlatform.value) {
      return normalized === normalizeEnterpriseId(store.currentEnterpriseId)
    }
    if (mode === 'switch') {
      return normalized === normalizeEnterpriseId(activeEnterpriseId.value)
    }
    if (!activeEnterpriseId.value) return true
    return normalized === activeEnterpriseId.value
  }

  return {
    isPlatform,
    enterpriseFilter,
    activeEnterpriseId,
    enterpriseOptions,
    enterpriseName,
    matchesEnterprise,
    showEnterpriseControl: isPlatform,
  }
}
