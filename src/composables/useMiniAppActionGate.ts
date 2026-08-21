import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { evaluateSensitiveActionGate } from '@/services/miniAppEligibility'

export type MiniAppActionFrom =
  | 'grab'
  | 'punch'
  | 'claim'
  | 'job'
  | 'onboarding'

/**
 * 敏感操作统一门禁：实名 → 不定时人脸（2/4h）→（可选）企业部门入驻
 */
export function useMiniAppActionGate() {
  const store = useAppStore()
  const router = useRouter()
  const { employeeId, employee, profileExt } = useMiniAppWorker()

  async function ensureActionAllowed(options?: {
    requireDepartment?: boolean
    enterpriseId?: string
    from?: MiniAppActionFrom
    redirectAfterFace?: string
  }): Promise<boolean> {
    const from = options?.from ?? 'grab'
    const result = evaluateSensitiveActionGate({
      employee: employee.value,
      profileExt: profileExt.value,
      departments: store.departments,
      jobs: store.jobRequirements,
      requireDepartment: options?.requireDepartment,
      enterpriseId: options?.enterpriseId,
    })

    if (result.ok) return true

    if (result.reason === 'real_name') {
      try {
        await ElMessageBox.confirm(
          '报名、打卡与领取任务前需先完成实名认证。',
          '请先实名认证',
          {
            confirmButtonText: '去实名认证',
            cancelButtonText: '取消',
            type: 'warning',
          },
        )
        await router.push({
          path: '/miniapp/onboarding',
          query: { step: 'realname' },
        })
      } catch {
        /* cancelled */
      }
      return false
    }

    if (result.reason === 'face_expired') {
      try {
        await ElMessageBox.confirm(
          `为保障人岗一致，需进行人脸核验（约每 ${result.intervalHours} 小时复核一次）。`,
          '请进行人脸识别',
          {
            confirmButtonText: '去人脸识别',
            cancelButtonText: '取消',
            type: 'warning',
          },
        )
        const redirect = options?.redirectAfterFace || router.currentRoute.value.fullPath
        await router.push({
          path: '/miniapp/face-verify/capture',
          query: {
            from,
            redirect,
          },
        })
      } catch {
        /* cancelled */
      }
      return false
    }

    if (result.reason === 'not_in_department') {
      if (!result.jobId) {
        ElMessage.warning('您暂时无法报名，请查看其他机会。')
        return false
      }
      try {
        await ElMessageBox.confirm(
          '您暂时没有报名权限，需要通过面试，请先进行岗位报名',
          '暂无报名权限',
          {
            confirmButtonText: '去报名',
            cancelButtonText: '取消',
            type: 'warning',
          },
        )
        await router.push(`/miniapp/recommend/job/${result.jobId}`)
      } catch {
        /* cancelled */
      }
      return false
    }

    return false
  }

  return {
    employeeId,
    ensureActionAllowed,
  }
}
