import type { TrainingOwnerScope } from '@/services/training'

export const trainingOwnerTypeOptions: { value: TrainingOwnerScope; label: string }[] = [
  { value: 'enterprise', label: '企业' },
  { value: 'global', label: '通用' },
]

export const trainingTypeFilterOptions: { value: 'all' | TrainingOwnerScope; label: string }[] = [
  { value: 'all', label: '全部类型' },
  { value: 'enterprise', label: '企业' },
  { value: 'global', label: '通用' },
]
