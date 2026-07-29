const STORAGE_PREFIX = 'shift-attendance:'
const DEMO_BRANDING_VERSION = 'sinopec-v6'

const DEMO_BRANDING_KEYS = [
  'departments',
  'teams',
  'employees',
  'punches',
  'attendanceGroups',
  'grabShiftSlots',
  'grabShiftApplications',
  'grabShiftWhitelist',
  'jobRequirements',
  'recruitmentLeads',
  'tasks',
  'taskInstances',
  'taskTypes',
  'taskWorkflows',
  'miniAppMessages',
  'miniJobApplications',
  'workerIncomeRecords',
  'workerProfileExts',
  'workerAgreements',
  'trainingCourses',
  'trainingMaterials',
  'trainingExams',
  'examQuestions',
  'examAttempts',
  'courseLearningRecords',
  'insurancePolicies',
  'billingRules',
]

/** 演示数据品牌升级：刷新本地缓存以加载最新 seed */
export function ensureDemoBrandingVersion() {
  const versionKey = `${STORAGE_PREFIX}demoBrandingVersion`
  if (localStorage.getItem(versionKey) === DEMO_BRANDING_VERSION) return
  DEMO_BRANDING_KEYS.forEach((key) => localStorage.removeItem(STORAGE_PREFIX + key))
  localStorage.removeItem(`${STORAGE_PREFIX}trainingCoursesVersion`)
  localStorage.removeItem(`${STORAGE_PREFIX}trainingExamsVersion`)
  localStorage.removeItem(`${STORAGE_PREFIX}courseLearningRecordsVersion`)
  localStorage.removeItem(`${STORAGE_PREFIX}examQuestionsVersion`)
  localStorage.setItem(versionKey, DEMO_BRANDING_VERSION)
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getMonthDays(year: number, month: number): string[] {
  const days: string[] = []
  const total = new Date(year, month, 0).getDate()
  for (let d = 1; d <= total; d += 1) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return days
}

export function getWeekday(dateStr: string): string {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return weekdays[new Date(dateStr).getDay()]
}

/** 获取某日期所在周的周一（ISO 周） */
export function getWeekStart(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return formatDate(d)
}

export function getWeekDates(weekStart: string): string[] {
  const dates: string[] = []
  const cur = new Date(weekStart)
  for (let i = 0; i < 7; i += 1) {
    dates.push(formatDate(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

export function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay()
  return day === 0 || day === 6
}

export function calcShiftHours(shift: { startTime: string; endTime: string; breakMinutes: number }): number {
  const [sh, sm] = shift.startTime.split(':').map(Number)
  const [eh, em] = shift.endTime.split(':').map(Number)
  let start = sh * 60 + sm
  let end = eh * 60 + em
  if (end <= start) end += 24 * 60
  return (end - start - shift.breakMinutes) / 60
}

export function buildDepartmentTree(departments: import('@/types').Department[]): import('@/types').DepartmentTreeNode[] {
  const map = new Map<string, import('@/types').DepartmentTreeNode>()
  departments.forEach((d) => map.set(d.id, { ...d, children: [] }))
  const roots: import('@/types').DepartmentTreeNode[] = []
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortNodes = (nodes: import('@/types').DepartmentTreeNode[]) => {
    nodes.sort((a, b) => a.sort - b.sort)
    nodes.forEach((n) => sortNodes(n.children))
  }
  sortNodes(roots)
  return roots
}

export function getDepartmentName(departments: import('@/types').Department[], id: string): string {
  return departments.find((d) => d.id === id)?.name ?? '-'
}

export function getDepartmentDescendantIds(
  departments: import('@/types').Department[],
  rootId: string,
): Set<string> {
  const ids = new Set<string>([rootId])
  let changed = true
  while (changed) {
    changed = false
    departments.forEach((d) => {
      if (d.parentId && ids.has(d.parentId) && !ids.has(d.id)) {
        ids.add(d.id)
        changed = true
      }
    })
  }
  return ids
}

export function countDepartmentEmployees(
  departments: import('@/types').Department[],
  employees: import('@/types').Employee[],
  departmentId: string,
  includeDescendants = true,
): number {
  const ids = includeDescendants
    ? getDepartmentDescendantIds(departments, departmentId)
    : new Set([departmentId])
  return employees.filter((e) => ids.has(e.departmentId) && e.status !== 'resigned').length
}

export function countDepartmentAccounts(
  departments: import('@/types').Department[],
  accounts: import('@/types').SystemAccount[],
  departmentId: string,
  includeDescendants = true,
): number {
  const ids = includeDescendants
    ? getDepartmentDescendantIds(departments, departmentId)
    : new Set([departmentId])
  return accounts.filter((a) => ids.has(a.departmentId)).length
}
