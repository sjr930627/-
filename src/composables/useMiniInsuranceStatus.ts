import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppNow } from '@/composables/useMiniAppNow'
import { hasActivePolicyForDate } from '@/services/insurance'
import { localDateStr } from '@/composables/useMiniPunch'

export function useMiniInsuranceStatus() {
  const store = useAppStore()
  const { employeeId } = useMiniAppWorker()
  const { now } = useMiniAppNow()

  const today = computed(() => localDateStr(now.value))

  const todayPolicy = computed(() =>
    store.insurancePolicies.find(
      (p) =>
        p.employeeId === employeeId.value &&
        p.workDate === today.value &&
        (p.status === 'active' || p.status === 'pending'),
    ),
  )

  const isInsuredToday = computed(() =>
    hasActivePolicyForDate(store.insurancePolicies, employeeId.value, today.value),
  )

  const statusLabel = computed(() => (isInsuredToday.value ? '投保中' : '当日未投保'))

  return { today, todayPolicy, isInsuredToday, statusLabel }
}
