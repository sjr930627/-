import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { seedWorkerProfileExts } from '@/mock/miniappSeed'

const STORAGE_KEY = 'miniapp:employeeId'

export function useMiniAppWorker() {
  const store = useAppStore()
  const employeeId = ref(localStorage.getItem(STORAGE_KEY) ?? 'emp_001')

  const employee = computed(() => store.employees.find((e) => e.id === employeeId.value))
  const department = computed(() =>
    store.departments.find((d) => d.id === employee.value?.departmentId),
  )
  const profileExt = computed(
    () =>
      store.workerProfileExts.find((p) => p.employeeId === employeeId.value) ??
      seedWorkerProfileExts.find((p) => p.employeeId === employeeId.value),
  )
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
