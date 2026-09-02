/** 考试场景图（中国移动营业厅主题，public/exam 静态资源） */
export const EXAM_SCENE_IMAGES = {
  missingExtinguisher: '/exam/sinopec-missing-extinguisher.svg',
  violations: '/exam/sinopec-violations.svg',
  nozzleIssue: '/exam/sinopec-nozzle-issue.svg',
  passwordRisk: '/exam/sinopec-password-risk.svg',
  constructionSafety: '/exam/sinopec-construction-safety.svg',
  printerRisk: '/exam/sinopec-printer-risk.svg',
  noSmokingZone: '/exam/sinopec-no-smoking-zone.svg',
  serviceBadge: '/exam/sinopec-service-badge.svg',
  extinguisherWrong: '/exam/sinopec-extinguisher-wrong.svg',
} as const

/** AI 出题模板 imageSeed → 中国移动场景图 */
export const AI_EXAM_IMAGE_BY_SEED: Record<string, string> = {
  'ai-sec-1': EXAM_SCENE_IMAGES.passwordRisk,
  'ai-sec-2': EXAM_SCENE_IMAGES.printerRisk,
  'ai-safe-1': EXAM_SCENE_IMAGES.constructionSafety,
  'ai-safe-2': EXAM_SCENE_IMAGES.noSmokingZone,
  'ai-svc-1': EXAM_SCENE_IMAGES.serviceBadge,
  'ai-emg-1': EXAM_SCENE_IMAGES.extinguisherWrong,
}

export function getAiExamImageUrl(imageSeed: string): string {
  return AI_EXAM_IMAGE_BY_SEED[imageSeed] ?? EXAM_SCENE_IMAGES.constructionSafety
}
