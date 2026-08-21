import type {
  AiRiskScenario,
  CourseScopeType,
  CourseStatus,
  CourseStudyMode,
  ExamQuestionType,
  ExamStatus,
  LearningStatus,
  TrainingMaterialCategory,
  TrainingMaterialStatus,
  TrainingMaterialType,
} from '@/types'

export const trainingMaterialTypeOptions: { value: TrainingMaterialType; label: string }[] = [
  { value: 'video', label: '视频' },
  { value: 'pdf', label: 'PDF文档' },
  { value: 'article', label: '图文' },
]

export const trainingMaterialCategoryOptions: { value: TrainingMaterialCategory; label: string }[] = [
  { value: 'info_security', label: '信息安全' },
  { value: 'safety', label: '安全生产' },
  { value: 'anti_fraud', label: '反诈骗' },
  { value: 'service', label: '服务规范' },
  { value: 'emergency', label: '应急处理' },
  { value: 'other', label: '其他' },
]

export const trainingMaterialStatusMap: Record<TrainingMaterialStatus, string> = {
  draft: '待审核',
  approved: '已审核',
}

export const courseStudyModeOptions: { value: CourseStudyMode; label: string }[] = [
  { value: 'sequential', label: '必须全部学完' },
  { value: 'free', label: '可跳读' },
]

export const courseScopeTypeOptions: { value: CourseScopeType; label: string }[] = [
  { value: 'all', label: '企业全体灵工' },
  { value: 'department', label: '按企业部门' },
  { value: 'tag', label: '按标签' },
]

export const courseGateOptions = [
  { key: 'requireExamPassForSchedule' as const, label: '考核通过后才可排班/抢班' },
  { key: 'requireExamPassForTask' as const, label: '考核通过后才可接任务' },
]

export const courseStatusMap: Record<CourseStatus, string> = {
  draft: '草稿',
  published: '已发布',
  offline: '已下架',
  closed: '已关闭',
}

export const courseStatusTagType: Record<CourseStatus, 'info' | 'success' | 'danger' | 'warning'> = {
  draft: 'info',
  published: 'success',
  offline: 'warning',
  closed: 'danger',
}

export const examStatusMap: Record<ExamStatus, string> = {
  draft: '草稿',
  published: '已发布',
  offline: '已下架',
}

export const examStatusTagType: Record<ExamStatus, 'info' | 'success' | 'warning'> = {
  draft: 'info',
  published: 'success',
  offline: 'warning',
}

export const examQuestionTypeMap: Record<ExamQuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
}

export const learningStatusMap: Record<LearningStatus, string> = {
  not_started: '未开始',
  in_progress: '学习中',
  completed: '已完成',
}

export const learningStatusTagType: Record<LearningStatus, 'info' | 'warning' | 'success'> = {
  not_started: 'info',
  in_progress: 'warning',
  completed: 'success',
}

export const aiScenarioOptions: { value: AiRiskScenario; label: string; desc: string }[] = [
  { value: 'info_security', label: '信息安全', desc: '电脑未锁屏、密码便签等' },
  { value: 'safety', label: '安全生产', desc: '未戴安全帽、高空未系安全带等' },
  { value: 'service', label: '服务规范', desc: '未佩戴工牌、与客户争吵等' },
  { value: 'emergency', label: '应急处理', desc: '灭火器使用、急救操作等' },
]

export const aiDifficultyOptions = [
  { value: 'easy' as const, label: '简单' },
  { value: 'medium' as const, label: '中等' },
  { value: 'hard' as const, label: '困难' },
]

export function getMaterialTypeLabel(type: TrainingMaterialType) {
  return trainingMaterialTypeOptions.find((o) => o.value === type)?.label ?? type
}

export function getMaterialCategoryLabel(
  cat: string | undefined,
  categories?: { id: string; name: string }[],
) {
  if (!cat) return '—'
  const custom = categories?.find((c) => c.id === cat || c.name === cat)
  if (custom) return custom.name
  return trainingMaterialCategoryOptions.find((o) => o.value === cat)?.label ?? cat
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
