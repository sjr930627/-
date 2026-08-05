import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { seedWorkerProfileExts } from '@/mock/miniappSeed'
import { readMiniAppSession } from '@/composables/useMiniAppAuth'

const STORAGE_KEY = 'miniapp:employeeId'

export function useMiniAppWorker() {
  const store = useAppStore()
  const employeeId = ref(readMiniAppSession()?.employeeId ?? localStorage.getItem(STORAGE_KEY) ?? 'emp_001')

  const employee = computed(() => store.employees.find((e) => e.id === employeeId.value))
  const department = computed(() =>
    store.departments.find((d) => d.id === employee.value?.departmentId),
  )
  const profileExt = computed(() => {
    const fromStore = store.workerProfileExts.find((p) => p.employeeId === employeeId.value)
    const fromSeed = seedWorkerProfileExts.find((p) => p.employeeId === employeeId.value)
    const base = fromStore ?? fromSeed
    if (!base) return undefined
    if (!fromSeed) return base
    return {
      ...fromSeed,
      ...base,
      faceVerifyStatus: base.faceVerifyStatus ?? fromSeed.faceVerifyStatus,
      faceVerifiedAt: base.faceVerifiedAt ?? fromSeed.faceVerifiedAt,
      schedulePreferences: base.schedulePreferences ?? fromSeed.schedulePreferences,
      partTimePreference: base.partTimePreference ?? fromSeed.partTimePreference,
      basicProofs: base.basicProofs ?? fromSeed.basicProofs,
      skillCertificates: base.skillCertificates ?? fromSeed.skillCertificates,
      profileCompleteness: base.profileCompleteness ?? fromSeed.profileCompleteness,
      permanentAddress: base.permanentAddress ?? fromSeed.permanentAddress,
    }
  })
  const paymentBinding = computed(() =>
    store.workerPaymentBindings.find((b) => b.employeeId === employeeId.value),
  )

  function setEmployee(id: string) {
    employeeId.value = id
    localStorage.setItem(STORAGE_KEY, id)
  }

  return {
    employeeId,
    employee,
    department,
    profileExt,
    paymentBinding,
    setEmployee,
  }
}
