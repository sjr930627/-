import { computed } from 'vue'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { faceVerifyStatusMap } from '@/constants/miniapp'
import type { WorkerFaceVerifyStatus } from '@/types'

export function useMiniFaceVerifyStatus() {
  const { profileExt } = useMiniAppWorker()

  const status = computed<WorkerFaceVerifyStatus>(
    () => profileExt.value?.faceVerifyStatus ?? 'unverified',
  )

  const statusMeta = computed(() => faceVerifyStatusMap[status.value])

  const isVerified = computed(() => status.value === 'verified')

  const verifiedAt = computed(() => profileExt.value?.faceVerifiedAt)

  return { status, statusMeta, isVerified, verifiedAt }
}
