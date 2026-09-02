import { EXAM_SCENE_IMAGES } from '@/constants/examImages'
import type {
  CourseLearningRecord,
  ExamAttempt,
  ExamQuestion,
  TrainingCourse,
  TrainingExam,
  TrainingMaterial,
  TrainingMaterialCategoryItem,
} from '@/types'
import { loadFromStorage, saveToStorage } from '@/utils'

const now = '2026-07-20T10:00:00'
const weekAgo = '2026-07-13T09:00:00'
const ENT_CM = 'ent_china_mobile_agent'
const ENT_PINGAN = 'ent_pingan_partner'

export const seedTrainingMaterialCategories: TrainingMaterialCategoryItem[] = [
  { id: 'tmc_info_security', name: '信息安全', enterpriseId: null, builtin: true, createdAt: weekAgo },
  { id: 'tmc_safety', name: '安全生产', enterpriseId: null, builtin: true, createdAt: weekAgo },
  { id: 'tmc_anti_fraud', name: '反诈骗', enterpriseId: null, builtin: true, createdAt: weekAgo },
  { id: 'tmc_service', name: '服务规范', enterpriseId: null, builtin: true, createdAt: weekAgo },
  { id: 'tmc_emergency', name: '应急处理', enterpriseId: null, builtin: true, createdAt: weekAgo },
  { id: 'tmc_other', name: '其他', enterpriseId: null, builtin: true, createdAt: weekAgo },
]

export function loadTrainingMaterialCategories(): TrainingMaterialCategoryItem[] {
  return loadFromStorage('trainingMaterialCategories', seedTrainingMaterialCategories)
}

export const seedTrainingMaterials: TrainingMaterial[] = [
  {
    id: 'tm_001',
    name: '信息安全操作规范',
    enterpriseId: ENT_CM,
    type: 'video',
    category: 'info_security',
    fileUrl: '/mock/training/info-security.mp4',
    fileName: 'info-security.mp4',
    fileSize: 85 * 1024 * 1024,
    tags: ['合规', '必修'],
    description: '<p>介绍办公环境信息安全基本要求，包括密码管理、屏幕锁定、文件保密等。</p>',
    status: 'approved',
    createdAt: weekAgo,
    updatedAt: weekAgo,
  },
  {
    id: 'tm_002',
    name: '安全生产手册',
    enterpriseId: ENT_CM,
    type: 'pdf',
    category: 'safety',
    fileUrl: '/mock/training/safety-manual.pdf',
    fileName: 'safety-manual.pdf',
    fileSize: 4.2 * 1024 * 1024,
    tags: ['安全', '现场'],
    description: `<p>施工现场安全规范与防护用品使用说明。</p>
<p>进入施工现场前，须确认已佩戴安全帽、反光背心及劳保鞋，并完成当日安全交底签到。</p>
<p>高空作业必须系安全带，工具须系防坠绳；电气作业前须确认断电并挂牌上锁。</p>
<p>发现隐患应立即上报班组长，不得擅自处理；遇紧急情况按应急流程撤离至指定集合点。</p>
<p>本章末附防护用品检查清单与常见违规案例，请阅读至文档底部。</p>`,
    status: 'approved',
    createdAt: weekAgo,
    updatedAt: now,
  },
  {
    id: 'tm_003',
    name: '反诈骗警示案例',
    enterpriseId: ENT_CM,
    type: 'article',
    category: 'anti_fraud',
    fileUrl: '/mock/training/anti-fraud',
    fileName: 'anti-fraud-images.zip',
    fileSize: 2.8 * 1024 * 1024,
    tags: ['反诈'],
    status: 'approved',
    createdAt: '2026-07-15T14:00:00',
    updatedAt: '2026-07-15T14:00:00',
  },
  {
    id: 'tm_004',
    name: '客户服务礼仪规范',
    enterpriseId: ENT_CM,
    type: 'video',
    category: 'service',
    fileUrl: '/mock/training/service-etiquette.mp4',
    fileName: 'service-etiquette.mp4',
    fileSize: 120 * 1024 * 1024,
    tags: ['服务', '礼仪'],
    status: 'approved',
    createdAt: '2026-07-18T11:00:00',
    updatedAt: '2026-07-18T11:00:00',
  },
  {
    id: 'tm_005',
    name: '应急处理流程图解',
    enterpriseId: ENT_CM,
    type: 'article',
    category: 'emergency',
    fileUrl: '/mock/training/emergency',
    fileName: 'emergency-guide',
    fileSize: 1.5 * 1024 * 1024,
    tags: ['应急'],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'tm_006',
    name: '营业厅终端陈列标准图文',
    enterpriseId: ENT_PINGAN,
    type: 'article',
    category: 'service',
    fileUrl: '/mock/training/store-display',
    fileName: 'store-display',
    fileSize: 2.1 * 1024 * 1024,
    tags: ['陈列', '营业厅'],
    description: '<p>浙江分公司营业厅货架陈列与价签规范。</p>',
    status: 'approved',
    createdAt: '2026-07-18T09:00:00',
    updatedAt: '2026-07-18T09:00:00',
  },
  {
    id: 'tm_g_001',
    name: '平台灵工通用合规须知',
    enterpriseId: null,
    type: 'video',
    category: 'info_security',
    fileUrl: '/mock/training/platform-compliance.mp4',
    fileName: 'platform-compliance.mp4',
    fileSize: 60 * 1024 * 1024,
    tags: ['通用', '必修'],
    description: '<p>面向全体灵工的平台级合规与行为规范基础培训。</p>',
    status: 'approved',
    createdAt: weekAgo,
    updatedAt: weekAgo,
  },
  {
    id: 'tm_g_002',
    name: '灵工接单与考勤须知',
    enterpriseId: null,
    type: 'article',
    category: 'other',
    fileUrl: '/mock/training/worker-guide',
    fileName: 'worker-guide',
    fileSize: 900 * 1024,
    tags: ['通用', '入门'],
    description: '<p>说明排班确认、打卡、任务领取等平台通用操作要求。</p>',
    status: 'approved',
    createdAt: '2026-07-14T10:00:00',
    updatedAt: '2026-07-14T10:00:00',
  },
]

export const seedTrainingExams: TrainingExam[] = [
  {
    id: 'te_001',
    name: '中国移动营业厅安全规范考核',
    enterpriseId: ENT_CM,
    description: '考核中国移动营业厅安全生产相关规范知识，80分及格，限时30分钟。',
    courseId: 'tc_001',
    durationMinutes: 30,
    passScore: 60,
    maxRetakes: 2,
    retakeIntervalHours: 24,
    status: 'published',
    createdAt: weekAgo,
    updatedAt: weekAgo,
    publishedAt: weekAgo,
  },
  {
    id: 'te_002',
    name: '中国移动信息安全合规测试',
    enterpriseId: ENT_CM,
    description: '检验中国移动营业厅信息安全意识与操作规范掌握情况。',
    courseId: 'tc_002',
    durationMinutes: 20,
    passScore: 80,
    maxRetakes: -1,
    retakeIntervalHours: 12,
    status: 'published',
    createdAt: '2026-07-16T10:00:00',
    updatedAt: '2026-07-16T10:00:00',
    publishedAt: '2026-07-16T10:00:00',
  },
  {
    id: 'te_003',
    name: '服务规范综合考核',
    enterpriseId: ENT_CM,
    description: '草稿状态，待完善题目后发布。',
    courseId: 'tc_003',
    durationMinutes: 25,
    passScore: 75,
    maxRetakes: 1,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'te_g_001',
    name: '平台灵工通用合规考核',
    enterpriseId: null,
    description: '平台级通用合规考核，面向全体灵工。',
    courseId: 'tc_g_001',
    durationMinutes: 20,
    passScore: 70,
    maxRetakes: 2,
    retakeIntervalHours: 24,
    status: 'published',
    createdAt: weekAgo,
    updatedAt: weekAgo,
    publishedAt: weekAgo,
  },
]

export const seedExamQuestions: ExamQuestion[] = [
  {
    id: 'eq_001',
    examId: 'te_001',
    type: 'single',
    content: '观察图片，图中营业厅存在什么安全隐患？应如何处理？',
    imageUrl: EXAM_SCENE_IMAGES.missingExtinguisher,
    options: [
      { key: 'A', text: '营业厅作业区未配置应急物资，应立即补齐并登记巡检' },
      { key: 'B', text: '员工未穿工服，仅需口头提醒即可' },
      { key: 'C', text: '地面有少量杂物，可等下班再清理' },
      { key: 'D', text: '无安全隐患，继续作业' },
    ],
    correctAnswers: ['A'],
    score: 15,
    explanation: '营业厅作业区必须配备有效应急物资并定期检查，发现缺失应立即补齐。',
    source: 'manual',
    createdAt: weekAgo,
  },
  {
    id: 'eq_002',
    examId: 'te_001',
    type: 'multiple',
    content: '观察图片，以下哪些属于营业厅现场违规行为？（多选）',
    imageUrl: EXAM_SCENE_IMAGES.violations,
    options: [
      { key: 'A', text: '营业厅作业区吸烟' },
      { key: 'B', text: '规范佩戴工牌并保持柜台整洁' },
      { key: 'C', text: '在柜台前使用私人手机长时间通话' },
      { key: 'D', text: '按规范引导客户取号候客' },
    ],
    correctAnswers: ['A', 'C'],
    score: 20,
    partialScore: true,
    explanation: '营业厅作业区严禁吸烟，接待客户时不得长时间使用私人手机，必须制止并上报班组长。',
    source: 'manual',
    createdAt: weekAgo,
  },
  {
    id: 'eq_003',
    examId: 'te_001',
    type: 'single',
    content: '观察图片，图中员工操作存在什么问题？正确做法是？',
    imageUrl: EXAM_SCENE_IMAGES.nozzleIssue,
    options: [
      { key: 'A', text: '工牌未佩戴且系统未锁屏，应立即佩戴工牌并锁定终端' },
      { key: 'B', text: '业务办理速度偏慢，应加快操作' },
      { key: 'C', text: '顾客未出示证件，可继续办理入网' },
      { key: 'D', text: '操作规范，无需处理' },
    ],
    correctAnswers: ['A'],
    score: 15,
    explanation: '业务办理结束后必须退出受理系统、锁定终端，防止客户信息泄露。',
    source: 'manual',
    createdAt: weekAgo,
  },
  {
    id: 'eq_004',
    examId: 'te_001',
    type: 'single',
    content: '观察图片，图中存在哪项信息安全违规？应如何处理？',
    imageUrl: EXAM_SCENE_IMAGES.passwordRisk,
    options: [
      { key: 'A', text: '电脑已锁屏，符合规范' },
      { key: 'B', text: '密码便签贴在显示器上，应立即清除并修改密码' },
      { key: 'C', text: '文件柜已上锁，符合规范' },
      { key: 'D', text: '访客已登记，符合规范' },
    ],
    correctAnswers: ['B'],
    score: 15,
    explanation: '密码明文张贴属于严重违规，须立即清除并强化安全意识。',
    source: 'ai',
    aiScenario: 'info_security',
    createdAt: weekAgo,
  },
  {
    id: 'eq_005',
    examId: 'te_001',
    type: 'multiple',
    content: '观察图片，施工现场存在哪些安全隐患？应如何处置？（多选）',
    imageUrl: EXAM_SCENE_IMAGES.constructionSafety,
    options: [
      { key: 'A', text: '未戴安全帽，应立即停止作业并佩戴' },
      { key: 'B', text: '正确佩戴反光背心' },
      { key: 'C', text: '高空作业未系安全带，须立即整改' },
      { key: 'D', text: '已设置安全警示标识' },
    ],
    correctAnswers: ['A', 'C'],
    score: 20,
    partialScore: true,
    explanation: '未戴安全帽及高空未系安全带，必须立即停工整改。',
    source: 'ai',
    aiScenario: 'safety',
    createdAt: weekAgo,
  },
  {
    id: 'eq_006',
    examId: 'te_002',
    type: 'single',
    content: '离开工位时应如何处理电脑屏幕？',
    options: [
      { key: 'A', text: '保持登录状态' },
      { key: 'B', text: '锁屏或注销' },
      { key: 'C', text: '最小化窗口即可' },
      { key: 'D', text: '无需处理' },
    ],
    correctAnswers: ['B'],
    score: 25,
    source: 'manual',
    createdAt: '2026-07-16T10:00:00',
  },
  {
    id: 'eq_007',
    examId: 'te_002',
    type: 'judge',
    content: '可以将工作账号密码告知同事以便代班。',
    options: [
      { key: 'A', text: '正确' },
      { key: 'B', text: '错误' },
    ],
    correctAnswers: ['B'],
    score: 25,
    source: 'manual',
    createdAt: '2026-07-16T10:00:00',
  },
  {
    id: 'eq_g_001',
    examId: 'te_g_001',
    type: 'single',
    content: '灵工接到排班或任务通知后，正确做法是？',
    options: [
      { key: 'A', text: '无视通知，到场再说' },
      { key: 'B', text: '及时确认，并按要求完成打卡与执行' },
      { key: 'C', text: '把账号交给他人代操作' },
      { key: 'D', text: '仅口头答应，无需在系统确认' },
    ],
    correctAnswers: ['B'],
    score: 50,
    source: 'manual',
    createdAt: weekAgo,
  },
  {
    id: 'eq_g_002',
    examId: 'te_g_001',
    type: 'judge',
    content: '平台通用合规要求适用于全体灵工，与所属企业无关。',
    options: [
      { key: 'A', text: '正确' },
      { key: 'B', text: '错误' },
    ],
    correctAnswers: ['A'],
    score: 50,
    source: 'manual',
    createdAt: weekAgo,
  },
]

export const seedTrainingCourses: TrainingCourse[] = [
  {
    id: 'tc_001',
    name: '中国移动新入职安全合规必修课',
    enterpriseId: ENT_CM,
    coverUrl: 'https://picsum.photos/seed/course-cover/320/180',
    description: '面向中国移动新入职灵工的安全与合规基础培训，含营业厅安全生产与信息安全内容。',
    materialIds: ['tm_001', 'tm_002'],
    studyMode: 'sequential',
    videoNoSeek: true,
    minStudyMinutes: 3,
    examId: 'te_001',
    scopeType: 'all',
    requireExamPassForSchedule: true,
    requireExamPassForTask: true,
    status: 'published',
    createdAt: weekAgo,
    updatedAt: weekAgo,
    publishedAt: weekAgo,
  },
  {
    id: 'tc_002',
    name: '中国移动信息安全专项培训',
    enterpriseId: ENT_CM,
    description: '强化中国移动营业厅信息安全意识，完成后需通过合规测试。',
    materialIds: ['tm_001'],
    studyMode: 'free',
    videoNoSeek: false,
    examId: 'te_002',
    scopeType: 'department',
    scopeDepartmentIds: ['dept_prod_a', 'dept_cm_field'],
    requireExamPassForSchedule: false,
    requireExamPassForTask: true,
    validFrom: '2026-07-01',
    validTo: '2026-12-31',
    status: 'published',
    createdAt: '2026-07-16T10:00:00',
    updatedAt: '2026-07-16T10:00:00',
    publishedAt: '2026-07-16T10:00:00',
  },
  {
    id: 'tc_003',
    name: '中国移动服务规范联合课',
    enterpriseId: ENT_CM,
    materialIds: ['tm_003', 'tm_004'],
    studyMode: 'sequential',
    videoNoSeek: true,
    examId: 'te_003',
    scopeType: 'tag',
    scopeTags: ['一线', '客服'],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'tc_004',
    name: '浙江营业厅陈列规范课',
    enterpriseId: ENT_PINGAN,
    description: '面向浙江分公司营业厅灵工的陈列与服务规范培训。',
    materialIds: ['tm_006'],
    studyMode: 'sequential',
    videoNoSeek: true,
    scopeType: 'department',
    scopeDepartmentIds: ['dept_pj_store', 'dept_pj_field'],
    requireExamPassForSchedule: false,
    requireExamPassForTask: false,
    status: 'published',
    createdAt: '2026-07-18T09:00:00',
    updatedAt: '2026-07-18T09:00:00',
    publishedAt: '2026-07-18T09:00:00',
  },
  {
    id: 'tc_g_001',
    name: '平台灵工通用入职课',
    enterpriseId: null,
    description: '不挂企业的平台通用培训，全体灵工可学习与考核。',
    materialIds: ['tm_g_001', 'tm_g_002'],
    studyMode: 'sequential',
    videoNoSeek: true,
    minStudyMinutes: 5,
    examId: 'te_g_001',
    scopeType: 'all',
    requireExamPassForSchedule: false,
    requireExamPassForTask: false,
    status: 'published',
    createdAt: weekAgo,
    updatedAt: weekAgo,
    publishedAt: weekAgo,
  },
]

export const seedCourseLearningRecords: CourseLearningRecord[] = [
  {
    id: 'clr_001',
    courseId: 'tc_001',
    employeeId: 'emp_001',
    status: 'completed',
    completedMaterialIds: ['tm_001', 'tm_002'],
    studyMinutes: 45,
    examPassed: true,
    examScore: 88,
    completedAt: '2026-07-27T10:00:00',
    updatedAt: '2026-07-27T10:00:00',
  },
  {
    id: 'clr_002',
    courseId: 'tc_001',
    employeeId: 'emp_002',
    status: 'completed',
    completedMaterialIds: ['tm_001', 'tm_002'],
    studyMinutes: 48,
    examPassed: true,
    examScore: 90,
    completedAt: '2026-07-19T11:00:00',
    updatedAt: '2026-07-19T11:00:00',
  },
  {
    id: 'clr_003',
    courseId: 'tc_001',
    employeeId: 'emp_003',
    status: 'in_progress',
    completedMaterialIds: ['tm_001'],
    studyMinutes: 25,
    updatedAt: '2026-07-20T09:00:00',
  },
  {
    id: 'clr_004',
    courseId: 'tc_001',
    employeeId: 'emp_004',
    status: 'not_started',
    completedMaterialIds: [],
    studyMinutes: 0,
    updatedAt: weekAgo,
  },
  {
    id: 'clr_005',
    courseId: 'tc_001',
    employeeId: 'emp_005',
    status: 'in_progress',
    completedMaterialIds: ['tm_001'],
    studyMinutes: 20,
    updatedAt: '2026-07-19T14:00:00',
  },
  {
    id: 'clr_006',
    courseId: 'tc_002',
    employeeId: 'emp_001',
    status: 'completed',
    completedMaterialIds: ['tm_001'],
    studyMinutes: 30,
    examPassed: true,
    examScore: 100,
    completedAt: '2026-07-17T15:00:00',
    updatedAt: '2026-07-17T15:00:00',
  },
  {
    id: 'clr_007',
    courseId: 'tc_002',
    employeeId: 'emp_006',
    status: 'not_started',
    completedMaterialIds: [],
    studyMinutes: 0,
    updatedAt: '2026-07-16T10:00:00',
  },
]

export const seedExamAttempts: ExamAttempt[] = [
  {
    id: 'ea_002',
    examId: 'te_001',
    employeeId: 'emp_002',
    courseId: 'tc_001',
    score: 90,
    passed: true,
    durationMinutes: 18,
    answers: { eq_001: ['A'], eq_002: ['A', 'C'], eq_003: ['B'], eq_004: ['B'], eq_005: ['A', 'C'] },
    attemptNumber: 1,
    submittedAt: '2026-07-19T10:55:00',
  },
  {
    id: 'ea_003',
    examId: 'te_001',
    employeeId: 'emp_003',
    courseId: 'tc_001',
    score: 65,
    passed: false,
    durationMinutes: 28,
    answers: { eq_001: ['A'], eq_002: ['A'], eq_003: ['B'], eq_004: ['A'], eq_005: ['C'] },
    attemptNumber: 1,
    submittedAt: '2026-07-19T17:00:00',
  },
  {
    id: 'ea_004',
    examId: 'te_002',
    employeeId: 'emp_001',
    courseId: 'tc_002',
    score: 100,
    passed: true,
    durationMinutes: 12,
    answers: { eq_006: ['B'], eq_007: ['B'] },
    attemptNumber: 1,
    submittedAt: '2026-07-17T14:55:00',
  },
  {
    id: 'ea_005',
    examId: 'te_002',
    employeeId: 'emp_002',
    courseId: 'tc_002',
    score: 75,
    passed: false,
    durationMinutes: 15,
    answers: { eq_006: ['B'], eq_007: ['A'] },
    attemptNumber: 1,
    submittedAt: '2026-07-18T10:00:00',
  },
]

const COURSE_LEARNING_STORAGE_VERSION = 4
const TRAINING_MATERIALS_STORAGE_VERSION = 1
const TRAINING_COURSES_STORAGE_VERSION = 4
const TRAINING_EXAMS_STORAGE_VERSION = 3
const EXAM_QUESTIONS_STORAGE_VERSION = 2

/** 修复考核 ↔ 课程双向关联（兼容 localStorage 旧数据） */
export function repairTrainingExamCourseLinks(
  courses: TrainingCourse[],
  exams: TrainingExam[],
): { courses: TrainingCourse[]; exams: TrainingExam[]; changed: boolean } {
  const nextCourses = courses.map((c) => ({ ...c }))
  const nextExams = exams.map((e) => ({ ...e }))
  let changed = false

  const setCourseExam = (courseId: string, examId: string) => {
    const idx = nextCourses.findIndex((c) => c.id === courseId)
    if (idx < 0) return
    if (nextCourses[idx].examId !== examId) {
      nextCourses[idx] = { ...nextCourses[idx], examId }
      changed = true
    }
  }

  const setExamCourse = (examId: string, courseId: string) => {
    const idx = nextExams.findIndex((e) => e.id === examId)
    if (idx < 0) return
    if (nextExams[idx].courseId !== courseId) {
      nextExams[idx] = { ...nextExams[idx], courseId }
      changed = true
    }
  }

  // 以 seed 为准恢复演示数据的关联
  for (const seedExam of seedTrainingExams) {
    if (!seedExam.courseId) continue
    if (nextExams.some((e) => e.id === seedExam.id) && nextCourses.some((c) => c.id === seedExam.courseId)) {
      setExamCourse(seedExam.id, seedExam.courseId)
      setCourseExam(seedExam.courseId, seedExam.id)
    }
  }
  for (const seedCourse of seedTrainingCourses) {
    if (!seedCourse.examId) continue
    if (nextCourses.some((c) => c.id === seedCourse.id) && nextExams.some((e) => e.id === seedCourse.examId)) {
      setCourseExam(seedCourse.id, seedCourse.examId)
      setExamCourse(seedCourse.examId, seedCourse.id)
    }
  }

  // 根据已有单向关联补全另一侧
  for (const exam of nextExams) {
    if (exam.courseId) setCourseExam(exam.courseId, exam.id)
  }
  for (const course of nextCourses) {
    if (course.examId) setExamCourse(course.examId, course.id)
  }

  return { courses: nextCourses, exams: nextExams, changed }
}

export function loadTrainingMaterials(): TrainingMaterial[] {
  const STORAGE_PREFIX = 'shift-attendance:'
  const versionKey = 'trainingMaterialsVersion'
  let materials = loadFromStorage<TrainingMaterial[]>('trainingMaterials', seedTrainingMaterials)
  const storedVersion = Number(localStorage.getItem(STORAGE_PREFIX + versionKey) ?? 0)
  if (storedVersion < TRAINING_MATERIALS_STORAGE_VERSION) {
    const custom = materials.filter((m) => !seedTrainingMaterials.some((s) => s.id === m.id))
    materials = seedTrainingMaterials.map((seed) => {
      const existing = materials.find((m) => m.id === seed.id)
      return existing ? { ...existing, ...seed, id: existing.id } : seed
    })
    materials.push(
      ...custom.map((m) => ({
        ...m,
        enterpriseId: m.enterpriseId === undefined ? ENT_CM : m.enterpriseId,
      })),
    )
    saveToStorage('trainingMaterials', materials)
    localStorage.setItem(STORAGE_PREFIX + versionKey, String(TRAINING_MATERIALS_STORAGE_VERSION))
  }
  return materials
}

/** 加载考试题目，并在版本升级时同步中国移动场景图 */
export function loadExamQuestions(): ExamQuestion[] {
  const STORAGE_PREFIX = 'shift-attendance:'
  const versionKey = 'examQuestionsVersion'

  let questions = loadFromStorage<ExamQuestion[]>('examQuestions', seedExamQuestions)
  const storedVersion = Number(localStorage.getItem(STORAGE_PREFIX + versionKey) ?? 0)

  if (storedVersion < EXAM_QUESTIONS_STORAGE_VERSION) {
    const seedById = new Map(seedExamQuestions.map((q) => [q.id, q]))
    questions = questions.map((q) => {
      const seed = seedById.get(q.id)
      if (!seed?.imageUrl) return q
      const isLegacyImage = !q.imageUrl || q.imageUrl.includes('picsum.photos')
      return isLegacyImage ? { ...q, imageUrl: seed.imageUrl } : q
    })
    for (const seed of seedExamQuestions) {
      if (!questions.some((q) => q.id === seed.id)) {
        questions.push({ ...seed })
      }
    }
    saveToStorage('examQuestions', questions)
    localStorage.setItem(STORAGE_PREFIX + versionKey, String(EXAM_QUESTIONS_STORAGE_VERSION))
  }

  return questions
}

export function loadTrainingExams(): TrainingExam[] {
  const STORAGE_PREFIX = 'shift-attendance:'
  const versionKey = 'trainingExamsVersion'
  let exams = loadFromStorage<TrainingExam[]>('trainingExams', seedTrainingExams)
  const storedVersion = Number(localStorage.getItem(STORAGE_PREFIX + versionKey) ?? 0)
  if (storedVersion < TRAINING_EXAMS_STORAGE_VERSION) {
    const customExams = exams.filter((e) => !seedTrainingExams.some((s) => s.id === e.id))
    exams = seedTrainingExams.map((seed) => {
      const existing = exams.find((e) => e.id === seed.id)
      return existing ? { ...existing, ...seed, id: existing.id } : seed
    })
    exams.push(...customExams)
    saveToStorage('trainingExams', exams)
    localStorage.setItem(STORAGE_PREFIX + versionKey, String(TRAINING_EXAMS_STORAGE_VERSION))
  }
  return exams
}

export function loadTrainingCourses(): TrainingCourse[] {
  const STORAGE_PREFIX = 'shift-attendance:'
  const versionKey = 'trainingCoursesVersion'

  let courses = loadFromStorage<TrainingCourse[]>('trainingCourses', seedTrainingCourses)
  const storedVersion = Number(localStorage.getItem(STORAGE_PREFIX + versionKey) ?? 0)

  if (storedVersion < TRAINING_COURSES_STORAGE_VERSION) {
    courses = seedTrainingCourses.map((seed) => {
      const existing = courses.find((c) => c.id === seed.id)
      return existing ? { ...existing, ...seed, id: existing.id } : seed
    })
    saveToStorage('trainingCourses', courses)
    localStorage.setItem(STORAGE_PREFIX + versionKey, String(TRAINING_COURSES_STORAGE_VERSION))
  }

  return courses
}

/** 加载课程与考核，并修复双向关联后写回 storage */
export function loadTrainingCoursesAndExams(): {
  courses: TrainingCourse[]
  exams: TrainingExam[]
} {
  let courses = loadTrainingCourses()
  let exams = loadTrainingExams()
  const repaired = repairTrainingExamCourseLinks(courses, exams)
  if (repaired.changed) {
    saveToStorage('trainingCourses', repaired.courses)
    saveToStorage('trainingExams', repaired.exams)
    courses = repaired.courses
    exams = repaired.exams
  }
  return { courses, exams }
}

/** 加载学习记录，并在版本升级时同步小程序演示进度 */
export function loadCourseLearningRecords(): CourseLearningRecord[] {
  const STORAGE_PREFIX = 'shift-attendance:'
  const versionKey = 'courseLearningRecordsVersion'

  let records = loadFromStorage<CourseLearningRecord[]>(
    'courseLearningRecords',
    seedCourseLearningRecords,
  )

  const storedVersion = Number(localStorage.getItem(STORAGE_PREFIX + versionKey) ?? 0)
  if (storedVersion < COURSE_LEARNING_STORAGE_VERSION) {
    const demoRec = seedCourseLearningRecords.find(
      (r) => r.employeeId === 'emp_001' && r.courseId === 'tc_001',
    )
    if (demoRec) {
      const idx = records.findIndex(
        (r) => r.employeeId === 'emp_001' && r.courseId === 'tc_001',
      )
      if (idx >= 0) {
        records[idx] = {
          ...records[idx],
          status: demoRec.status,
          completedMaterialIds: [...demoRec.completedMaterialIds],
          studyMinutes: demoRec.studyMinutes,
          updatedAt: demoRec.updatedAt,
          completedAt: demoRec.completedAt,
          examPassed: demoRec.examPassed,
          examScore: demoRec.examScore,
        }
      } else {
        records.push({ ...demoRec })
      }
    }
    saveToStorage('courseLearningRecords', records)
    localStorage.setItem(STORAGE_PREFIX + versionKey, String(COURSE_LEARNING_STORAGE_VERSION))
  }

  return records
}
