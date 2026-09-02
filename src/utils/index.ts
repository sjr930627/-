const STORAGE_PREFIX = 'shift-attendance:'
const DEMO_BRANDING_VERSION = 'sinopec-v25'

const DEMO_BRANDING_KEYS = [
  'enterprises',
  'departments',
  'teams',
  'employees',
  'enterprisePositions',
  'punches',
  'assignments',
  'manualOverrides',
  'attendanceGroups',
  'grabShiftSlots',
  'grabShiftApplications',
  'grabShiftWhitelist',
  'grabInterviewConfigs',
  'jobRequirements',
  'recruitmentLeads',
  'tasks',
  'taskInstances',
  'taskTypes',
  'taskWorkflows',
  'makeupRequests',
  'cancelShiftRequests',
  'miniAppMessages',
  'miniJobApplications',
  'workerIncomeRecords',
  'workerProfileExts',
  'workerAgreements',
  'workerJoinApplications',
  'trainingCourses',
  'trainingMaterials',
  'trainingMaterialCategories',
  'trainingExams',
  'examQuestions',
  'examAttempts',
  'courseLearningRecords',
  'insurancePolicies',
  'billingRules',
  'settlementBills',
  'serviceContracts',
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

/** 补齐开票抬头 id / 默认标记（兼容旧本地数据） */
export function ensureEnterpriseInvoiceProfiles(
  profiles: import('@/types').EnterpriseInvoiceProfile[],
  seed: import('@/types').EnterpriseInvoiceProfile[],
): import('@/types').EnterpriseInvoiceProfile[] {
  const result: import('@/types').EnterpriseInvoiceProfile[] = profiles.map((profile, index) => ({
    ...profile,
    id: profile.id || `eip_legacy_${profile.enterpriseId}_${index}`,
  }))

  // 每个企业至少保留一个默认抬头
  const byEnterprise = new Map<string, import('@/types').EnterpriseInvoiceProfile[]>()
  for (const profile of result) {
    const list = byEnterprise.get(profile.enterpriseId) ?? []
    list.push(profile)
    byEnterprise.set(profile.enterpriseId, list)
  }
  for (const list of byEnterprise.values()) {
    if (!list.some((item) => item.isDefault)) {
      list[0].isDefault = true
    }
  }

  for (const s of seed) {
    if (result.some((item) => item.id === s.id)) continue
    // 同企业同税号已存在则跳过
    if (result.some((item) => item.enterpriseId === s.enterpriseId && item.taxNo === s.taxNo)) {
      continue
    }
    result.push({ ...s })
  }
  return result
}

/** 补齐账单部门/付款企业字段（兼容旧本地数据） */
export function ensureSettlementBills(
  bills: import('@/types').SettlementBill[],
): import('@/types').SettlementBill[] {
  return bills.map((bill) => {
    const departmentScope = bill.departmentScope ?? 'all'
    return {
      ...bill,
      departmentScope,
      departmentName: bill.departmentName?.trim() || '全公司',
      departmentId: departmentScope === 'department' ? bill.departmentId : undefined,
      payerEnterpriseName: bill.payerEnterpriseName,
      payerCreditCode: bill.payerCreditCode,
      serviceFeeWaiver: bill.serviceFeeWaiver ?? 0,
    }
  })
}

/** 兼容旧流水类型，并补齐演示失败流水 */
export function ensureFundTransactions(
  transactions: import('@/types').FundTransaction[],
  seed: import('@/types').FundTransaction[],
): import('@/types').FundTransaction[] {
  const normalize = (raw: Record<string, unknown>): import('@/types').FundTransaction => {
    const legacyType = String(raw.type ?? '')
    let type: import('@/types').FundTransactionType = 'transfer'
    let direction: import('@/types').FundTransactionDirection =
      (raw.direction as import('@/types').FundTransactionDirection) ?? 'out'

    if (legacyType === 'income') {
      type = 'income'
      direction = (raw.direction as import('@/types').FundTransactionDirection) ?? 'in'
    } else if (legacyType === 'payout') {
      type = 'payout'
      direction = (raw.direction as import('@/types').FundTransactionDirection) ?? 'out'
    } else if (legacyType === 'transfer') {
      type = 'transfer'
      direction = (raw.direction as import('@/types').FundTransactionDirection) ?? 'out'
    } else if (legacyType === 'transfer_in') {
      type = 'transfer'
      direction = 'in'
    } else if (
      legacyType === 'transfer_out' ||
      legacyType === 'expense' ||
      legacyType === 'adjustment'
    ) {
      type = 'transfer'
      direction = 'out'
    }

    return {
      id: String(raw.id ?? ''),
      accountId: String(raw.accountId ?? ''),
      providerId: String(raw.providerId ?? ''),
      type,
      direction,
      amount: Number(raw.amount ?? 0),
      balanceAfter: Number(raw.balanceAfter ?? 0),
      counterparty: raw.counterparty as string | undefined,
      counterpartyAccount: raw.counterpartyAccount as string | undefined,
      relatedOrderNo: raw.relatedOrderNo as string | undefined,
      remark: String(raw.remark ?? ''),
      status: (raw.status as import('@/types').FundTransactionStatus) ?? 'success',
      failReason: raw.failReason as string | undefined,
      createdAt: String(raw.createdAt ?? ''),
    }
  }

  const result = transactions.map((tx) => normalize(tx as unknown as Record<string, unknown>))
  for (const s of seed) {
    if (result.some((tx) => tx.id === s.id)) continue
    result.push({ ...s })
  }
  return result
}

/** 补齐单笔班次/任务待结算明细，并清理旧的周期汇总待结算单 */
export function ensureSettlementManageOrders(
  orders: import('@/types').SettlementManageOrder[],
  seed: import('@/types').SettlementManageOrder[],
): import('@/types').SettlementManageOrder[] {
  const legacyAggregatedPendingIds = new Set([
    'smo_h_001',
    'smo_h_002',
    'smo_t_001',
    'smo_t_003',
  ])
  const result = orders.filter((order) => {
    if (!legacyAggregatedPendingIds.has(order.id)) return true
    return !order.workerLines.every((line) => line.status === 'pending_settlement')
  })
  for (const s of seed) {
    if (result.some((order) => order.id === s.id)) continue
    result.unshift({
      ...s,
      workerLines: s.workerLines.map((line) => ({ ...line })),
    })
  }
  return result
}

export function ensureWorkerIncomeSeed(
  records: import('@/types').WorkerIncomeRecord[],
  seed: import('@/types').WorkerIncomeRecord[],
): import('@/types').WorkerIncomeRecord[] {
  const result = [...records]
  const demoEmployees = [
    ...new Set(seed.filter((s) => s.status === 'claimable').map((s) => s.employeeId)),
  ]

  for (const employeeId of demoEmployees) {
    const hasClaimable = result.some(
      (r) => r.employeeId === employeeId && r.status === 'claimable',
    )
    if (hasClaimable) continue

    for (const s of seed) {
      if (s.status !== 'claimable' || s.employeeId !== employeeId) continue
      const idx = result.findIndex((r) => r.id === s.id)
      const fresh = { ...s, items: s.items ? [...s.items] : undefined }
      if (idx >= 0) result[idx] = fresh
      else result.unshift(fresh)
    }
  }

  for (const s of seed) {
    const idx = result.findIndex((r) => r.id === s.id)
    if (idx >= 0) {
      const current = result[idx]
      const patch: Partial<typeof current> = {}
      const seedHasItems = !!s.items?.length
      const localMissingCalcType = current.items?.some(
        (i) => !('calcType' in i) || !(i as { calcType?: string }).calcType,
      )
      const itemCountChanged = seedHasItems && (current.items?.length ?? 0) !== s.items!.length
      const hasAggregatedItem = current.items?.some(
        (i) =>
          (i.calcType === 'hourly' && (i.quantity ?? 0) > 24) ||
          (i.calcType === 'task' && (i.quantity ?? 0) > 1) ||
          /汇总/.test(i.title),
      )
      if (seedHasItems && (!current.items?.length || localMissingCalcType || itemCountChanged || hasAggregatedItem)) {
        patch.items = [...s.items!]
        patch.amount = s.amount
        if (s.tax != null) patch.tax = s.tax
        if (s.netAmount != null) patch.netAmount = s.netAmount
      }
      if (current.status === 'pending_settlement' && s.status === 'pending_settlement') {
        patch.amount = s.amount
        if (s.title) patch.title = s.title
        if (s.enterpriseId) patch.enterpriseId = s.enterpriseId
        if (s.enterpriseName) patch.enterpriseName = s.enterpriseName
      }
      if (current.status === 'claimable' && s.status === 'claimable') {
        if (s.title) patch.title = s.title
        if (s.enterpriseId) patch.enterpriseId = s.enterpriseId
        if (s.enterpriseName) patch.enterpriseName = s.enterpriseName
        if (s.amount != null) patch.amount = s.amount
      }
      if (current.status === 'claimed' && s.status === 'claimed' && !current.claimBatchId && s.claimBatchId) {
        patch.claimBatchId = s.claimBatchId
      }
      if (Object.keys(patch).length > 0) result[idx] = { ...current, ...patch }
    } else {
      result.unshift({ ...s, items: s.items ? [...s.items] : undefined })
    }
  }

  return result
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

/** ISO 周序号（1-53） */
export function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  )
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
