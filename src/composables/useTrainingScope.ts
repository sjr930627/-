import { computed, ref, type Ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import {
  filterTrainingByOwnerScope,
  isGlobalTrainingOwner,
  type TrainingOwnerScope,
} from '@/services/training'

export type TrainingTypeFilter = 'all' | TrainingOwnerScope

/** 培训模块：企业/通用合并展示，按类型区分 */
export function useTrainingScope() {
  const store = useAppStore()
  const { isPlatform, isEnterprise } = usePortal()

  /** 平台端类型筛选：全部 / 企业 / 通用 */
  const typeFilter = ref<TrainingTypeFilter>(isEnterprise.value ? 'enterprise' : 'all')
  const enterpriseFilter = ref('')

  const defaultEnterpriseId = computed(() => {
    if (isEnterprise.value) return store.currentEnterpriseId
    return store.enterprises[0]?.id ?? store.currentEnterpriseId
  })

  function filterByTrainingType<T extends { enterpriseId?: string | null }>(items: T[]): T[] {
    if (isEnterprise.value) {
      return filterTrainingByOwnerScope(items, 'enterprise', store.currentEnterpriseId)
    }
    if (typeFilter.value === 'global') {
      return filterTrainingByOwnerScope(items, 'global')
    }
    if (typeFilter.value === 'enterprise') {
      return filterTrainingByOwnerScope(items, 'enterprise', enterpriseFilter.value || undefined)
    }
    // all：通用 + 企业；若选了企业则保留通用 + 该企业
    if (enterpriseFilter.value) {
      return items.filter(
        (item) =>
          isGlobalTrainingOwner(item.enterpriseId) || item.enterpriseId === enterpriseFilter.value,
      )
    }
    return items
  }

  /** 表单内可选资料/考核/课程：按当前编辑项的归属过滤 */
  function filterPeersForOwner<T extends { enterpriseId?: string | null }>(
    items: T[],
    ownerEnterpriseId: string | null | undefined,
  ): T[] {
    if (isGlobalTrainingOwner(ownerEnterpriseId)) {
      return filterTrainingByOwnerScope(items, 'global')
    }
    const entId = ownerEnterpriseId || (isEnterprise.value ? store.currentEnterpriseId : undefined)
    return filterTrainingByOwnerScope(items, 'enterprise', entId)
  }

  function ownerTypeLabel(enterpriseId: string | null | undefined) {
    return isGlobalTrainingOwner(enterpriseId) ? '通用' : '企业'
  }

  function progressPath(courseId: string) {
    if (isEnterprise.value) {
      return { path: '/enterprise/training/progress', query: { course: courseId } }
    }
    return { path: '/training/progress', query: { course: courseId } }
  }

  function examResultPath(examId: string) {
    if (isEnterprise.value) {
      return { path: '/enterprise/training/exam-results', query: { exam: examId } }
    }
    return { path: '/training/exam-results', query: { exam: examId } }
  }

  function examQuestionsPath(examId: string) {
    if (isEnterprise.value) return `/enterprise/training/exams/${examId}/questions`
    return `/training/exams/${examId}/questions`
  }

  return {
    isPlatform,
    isEnterprise,
    typeFilter: typeFilter as Ref<TrainingTypeFilter>,
    enterpriseFilter,
    defaultEnterpriseId,
    filterByTrainingType,
    filterPeersForOwner,
    ownerTypeLabel,
    progressPath,
    examResultPath,
    examQuestionsPath,
  }
}
