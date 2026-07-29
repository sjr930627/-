import { getAiExamImageUrl } from '@/constants/examImages'
import type {
  AiQuestionDifficulty,
  AiRiskScenario,
  CourseLearningRecord,
  Employee,
  ExamAttempt,
  ExamQuestion,
  ExamQuestionType,
  TrainingCourse,
  TrainingExam,
  TrainingMaterial,
} from '@/types'

export function countMaterialReferences(courses: TrainingCourse[], materialId: string) {
  return courses.filter((c) => c.materialIds.includes(materialId)).length
}

export function countCoursesUsingExam(courses: TrainingCourse[], examId: string) {
  return courses.filter((c) => c.examId === examId).length
}

export function getExamLinkedCourses(courses: TrainingCourse[], exam: TrainingExam) {
  if (exam.courseId) {
    const primary = courses.find((c) => c.id === exam.courseId)
    return primary ? [primary] : []
  }
  return courses.filter((c) => c.examId === exam.id)
}

export function getExamLinkedCourseLabel(courses: TrainingCourse[], exam: TrainingExam) {
  const linked = getExamLinkedCourses(courses, exam)
  if (linked.length === 0) return '-'
  return linked.map((c) => c.name).join('、')
}

export function isCourseLearningCompleted(record: CourseLearningRecord, course: TrainingCourse) {
  if (record.status === 'completed') return true
  return getLearningProgress(record, course) >= 100
}

export function getExamEligibilityLabel(
  record: CourseLearningRecord,
  course: TrainingCourse,
  examPassed?: boolean,
  examScore?: number,
) {
  const progress = getLearningProgress(record, course)
  if (progress < 100) return `待解锁（学习 ${progress}%）`
  if (examPassed === true) return `通过 ${examScore ?? '-'}分`
  if (examPassed === false) return `未通过 ${examScore ?? 0}分`
  return '可考试'
}

export function canEmployeeTakeExam(
  employeeId: string,
  course: TrainingCourse,
  record: CourseLearningRecord | undefined,
  exam: TrainingExam,
  attempts: ExamAttempt[],
) {
  if (!record || !isCourseLearningCompleted(record, course)) return false
  const empAttempts = attempts
    .filter((a) => a.examId === exam.id && a.employeeId === employeeId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  const last = empAttempts[0]
  if (last?.passed) return false
  if (exam.maxRetakes >= 0 && empAttempts.length >= exam.maxRetakes) return false
  return true
}

export function getExamTotalScore(questions: ExamQuestion[]) {
  return questions.reduce((s, q) => s + q.score, 0)
}

export function getExamQuestions(examId: string, questions: ExamQuestion[]) {
  return questions.filter((q) => q.examId === examId)
}

export function resolveCourseAssignees(
  course: TrainingCourse,
  employees: Employee[],
  _departments: { id: string }[],
): Employee[] {
  const active = employees.filter((e) => e.status === 'active')
  if (course.scopeType === 'all') return active
  if (course.scopeType === 'department') {
    const deptIds = new Set(course.scopeDepartmentIds ?? [])
    return active.filter((e) => deptIds.has(e.departmentId))
  }
  if (course.scopeType === 'tag') {
    const tags = new Set(course.scopeTags ?? [])
    return active.filter((e) => e.skills.some((s) => tags.has(s)))
  }
  return active
}

export function getCourseCompletionStats(
  course: TrainingCourse,
  records: CourseLearningRecord[],
  employees: Employee[],
  departments: { id: string; name: string }[],
) {
  const assignees = resolveCourseAssignees(course, employees, departments)
  const courseRecords = records.filter((r) => r.courseId === course.id)
  const completed = courseRecords.filter((r) => r.status === 'completed').length
  const total = assignees.length
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0
  const avgMinutes =
    courseRecords.length > 0
      ? Math.round(
          courseRecords.reduce((s, r) => s + r.studyMinutes, 0) / courseRecords.length,
        )
      : 0
  return { total, completed, rate, avgMinutes, assignees: assignees.length }
}

export function getDepartmentCompletionRates(
  course: TrainingCourse,
  records: CourseLearningRecord[],
  employees: Employee[],
  departments: { id: string; name: string }[],
) {
  const assignees = resolveCourseAssignees(course, employees, departments)
  const byDept = new Map<string, { name: string; total: number; completed: number }>()
  for (const emp of assignees) {
    const dept = departments.find((d) => d.id === emp.departmentId)
    const name = dept?.name ?? '未分配'
    const entry = byDept.get(emp.departmentId) ?? { name, total: 0, completed: 0 }
    entry.total += 1
    const rec = records.find((r) => r.courseId === course.id && r.employeeId === emp.id)
    if (rec?.status === 'completed') entry.completed += 1
    byDept.set(emp.departmentId, entry)
  }
  return [...byDept.values()]
    .map((d) => ({ ...d, rate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate)
}

export function getExamStats(
  exam: TrainingExam,
  courses: TrainingCourse[],
  attempts: ExamAttempt[],
  employees: Employee[],
  departments: { id: string; name: string }[],
) {
  const linkedCourses = courses.filter((c) => c.examId === exam.id && c.status === 'published')
  const assigneeIds = new Set<string>()
  for (const c of linkedCourses) {
    resolveCourseAssignees(c, employees, departments).forEach((e) => assigneeIds.add(e.id))
  }
  const examAttempts = attempts.filter((a) => a.examId === exam.id)
  const takenIds = new Set(examAttempts.map((a) => a.employeeId))
  const passed = examAttempts.filter((a) => a.passed).length
  const avgScore =
    examAttempts.length > 0
      ? Math.round(examAttempts.reduce((s, a) => s + a.score, 0) / examAttempts.length)
      : 0
  const passRate =
    examAttempts.length > 0 ? Math.round((passed / examAttempts.length) * 100) : 0
  return {
    shouldTake: assigneeIds.size,
    taken: takenIds.size,
    passed,
    passRate,
    avgScore,
    attempts: examAttempts.length,
  }
}

export function getScoreDistribution(attempts: ExamAttempt[]) {
  const buckets = [
    { label: '0-59', min: 0, max: 59, count: 0 },
    { label: '60-79', min: 60, max: 79, count: 0 },
    { label: '80-89', min: 80, max: 89, count: 0 },
    { label: '90-100', min: 90, max: 100, count: 0 },
  ]
  for (const a of attempts) {
    const bucket = buckets.find((b) => a.score >= b.min && a.score <= b.max)
    if (bucket) bucket.count += 1
  }
  return buckets
}

const AI_TEMPLATES: Record<
  AiRiskScenario,
  { imageSeed: string; content: string; options: { key: string; text: string }[]; answers: string[]; explanation: string }[]
> = {
  info_security: [
    {
      imageSeed: 'ai-sec-1',
      content: '请找出图中不符合信息安全规范的行为',
      options: [
        { key: 'A', text: '电脑已锁屏' },
        { key: 'B', text: '密码便签贴在显示器上' },
        { key: 'C', text: '文件柜已上锁' },
        { key: 'D', text: '访客已登记' },
      ],
      answers: ['B'],
      explanation: '密码明文张贴在显示器上，且电脑未锁屏离开。',
    },
    {
      imageSeed: 'ai-sec-2',
      content: '图中存在哪项数据泄露风险？',
      options: [
        { key: 'A', text: '敏感文件遗留在打印机旁' },
        { key: 'B', text: '使用复杂密码' },
        { key: 'C', text: '关闭办公室门窗' },
        { key: 'D', text: '佩戴工牌' },
      ],
      answers: ['A'],
      explanation: '打印的敏感文件未及时取走，存在泄露风险。',
    },
  ],
  safety: [
    {
      imageSeed: 'ai-safe-1',
      content: '图中存在哪些安全生产违规行为？（多选）',
      options: [
        { key: 'A', text: '未戴安全帽' },
        { key: 'B', text: '正确穿戴反光背心' },
        { key: 'C', text: '高空作业未系安全带' },
        { key: 'D', text: '设置安全警示标识' },
      ],
      answers: ['A', 'C'],
      explanation: '施工现场未戴安全帽，且高空作业人员未系安全带。',
    },
    {
      imageSeed: 'ai-safe-2',
      content: '图中哪项操作不符合安全规范？',
      options: [
        { key: 'A', text: '使用绝缘工具' },
        { key: 'B', text: '在禁火区吸烟' },
        { key: 'C', text: '佩戴防护手套' },
        { key: 'D', text: '检查设备接地' },
      ],
      answers: ['B'],
      explanation: '禁火区域内严禁吸烟，存在火灾隐患。',
    },
  ],
  service: [
    {
      imageSeed: 'ai-svc-1',
      content: '图中服务人员哪项行为不符合服务规范？',
      options: [
        { key: 'A', text: '未佩戴工牌' },
        { key: 'B', text: '微笑接待客户' },
        { key: 'C', text: '保持工位整洁' },
        { key: 'D', text: '主动询问需求' },
      ],
      answers: ['A'],
      explanation: '服务人员应佩戴工牌以便客户识别身份。',
    },
  ],
  emergency: [
    {
      imageSeed: 'ai-emg-1',
      content: '图中灭火器使用方式是否正确？',
      options: [
        { key: 'A', text: '正确' },
        { key: 'B', text: '错误' },
      ],
      answers: ['B'],
      explanation: '灭火器喷嘴应对准火焰根部，图中操作方向不正确。',
    },
  ],
}

export function generateAiRiskQuestions(params: {
  scenario: AiRiskScenario
  type: ExamQuestionType
  count: number
  difficulty: AiQuestionDifficulty
  examId: string
  baseScore?: number
}): Omit<ExamQuestion, 'id' | 'createdAt'>[] {
  const templates = AI_TEMPLATES[params.scenario] ?? []
  const scoreMap = { easy: 10, medium: 15, hard: 20 }
  const score = params.baseScore ?? scoreMap[params.difficulty]
  const result: Omit<ExamQuestion, 'id' | 'createdAt'>[] = []
  for (let i = 0; i < params.count; i++) {
    const tpl = templates[i % templates.length]
    const qType = params.type === 'multiple' && tpl.answers.length > 1 ? 'multiple' : params.type === 'judge' ? 'judge' : 'single'
    result.push({
      examId: params.examId,
      type: qType,
      content: tpl.content,
      imageUrl: getAiExamImageUrl(tpl.imageSeed),
      options: tpl.options,
      correctAnswers: qType === 'single' || qType === 'judge' ? [tpl.answers[0]] : tpl.answers,
      score,
      partialScore: qType === 'multiple',
      explanation: tpl.explanation,
      source: 'ai',
      aiScenario: params.scenario,
    })
  }
  return result
}

export function getLearningProgress(record: CourseLearningRecord, course: TrainingCourse) {
  const total = course.materialIds.length
  const done = record.completedMaterialIds.length
  return total > 0 ? Math.round((done / total) * 100) : 0
}

/** PDF/图文最低阅读时长（分钟），取自课程配置 */
export function getMaterialMinReadMinutes(course: TrainingCourse, materialType: TrainingMaterial['type']) {
  if (materialType === 'video') return 0
  return Math.max(1, course.minStudyMinutes ?? 3)
}

/** 顺序学习模式下，是否可访问该资料 */
export function canAccessMaterial(
  course: TrainingCourse,
  materialId: string,
  completedMaterialIds: string[],
) {
  if (course.studyMode === 'free') return true
  const idx = course.materialIds.indexOf(materialId)
  if (idx <= 0) return true
  for (let i = 0; i < idx; i++) {
    if (!completedMaterialIds.includes(course.materialIds[i])) return false
  }
  return true
}

export function getEmployeeExamStatus(
  employeeId: string,
  examId: string,
  attempts: ExamAttempt[],
) {
  const empAttempts = attempts
    .filter((a) => a.examId === examId && a.employeeId === employeeId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  if (empAttempts.length === 0) return { status: 'not_taken' as const }
  const latest = empAttempts[0]
  return {
    status: latest.passed ? ('passed' as const) : ('failed' as const),
    score: latest.score,
    attemptNumber: latest.attemptNumber,
    submittedAt: latest.submittedAt,
    durationMinutes: latest.durationMinutes,
    attemptId: latest.id,
  }
}

export function gradeExamAnswers(
  questions: ExamQuestion[],
  answers: Record<string, string[]>,
) {
  let score = 0
  let maxScore = 0
  const details = questions.map((q) => {
    maxScore += q.score
    const userAns = [...(answers[q.id] ?? [])].sort()
    const correctAns = [...q.correctAnswers].sort()
    const isCorrect =
      userAns.length === correctAns.length &&
      userAns.every((a, i) => a === correctAns[i])
    let earned = 0
    if (isCorrect) {
      earned = q.score
    } else if (q.type === 'multiple' && q.partialScore) {
      const wrongSelected = userAns.some((a) => !correctAns.includes(a))
      const correctSelected = userAns.filter((a) => correctAns.includes(a)).length
      if (!wrongSelected && correctSelected > 0) {
        earned = Math.round((correctSelected / correctAns.length) * q.score)
      }
    }
    score += earned
    return {
      questionId: q.id,
      isCorrect,
      earned,
      userAnswers: userAns,
      correctAnswers: correctAns,
    }
  })
  return { score, maxScore, details }
}

export function answersEqual(a: string[], b: string[]) {
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.length === sb.length && sa.every((v, i) => v === sb[i])
}
