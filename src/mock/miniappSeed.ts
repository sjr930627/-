import type {
  MiniAppMessage,
  MiniJobApplication,
  WorkerAgreement,
  WorkerIncomeRecord,
  WorkerPaymentBinding,
  WorkerProfileExt,
} from '@/types'

export const seedMiniAppMessages: MiniAppMessage[] = [
  {
    id: 'msg_001',
    employeeId: 'emp_001',
    category: 'income',
    title: '收入可领取',
    content: '您有 2 笔中石化任务收入共计 ¥320 可领取，请及时操作。',
    read: false,
    createdAt: '2026-07-27T09:00:00',
  },
  {
    id: 'msg_002',
    employeeId: 'emp_001',
    category: 'schedule',
    title: '明日排班提醒',
    content: '您明日（7月28日）中石化朝阳站排班为早班 08:00-16:00，请准时到岗。',
    read: false,
    createdAt: '2026-07-27T08:00:00',
  },
  {
    id: 'msg_003',
    employeeId: 'emp_001',
    category: 'task',
    title: '任务审核通过',
    content: '「中石化非油促销-202607」任务已审核通过，收入将计入待领取。',
    read: true,
    createdAt: '2026-07-26T16:30:00',
  },
  {
    id: 'msg_004',
    employeeId: 'emp_001',
    category: 'withdraw',
    title: '提现成功',
    content: '您于 7月25日 提现 ¥1,850.00 已到账支付宝。',
    read: true,
    createdAt: '2026-07-25T14:20:00',
  },
  {
    id: 'msg_005',
    employeeId: 'emp_001',
    category: 'system',
    title: '培训课程提醒',
    content: '「中石化新入职安全合规必修课」尚未完成，请尽快学习。',
    read: false,
    createdAt: '2026-07-24T10:00:00',
  },
]

export const seedWorkerIncomeRecords: WorkerIncomeRecord[] = [
  {
    id: 'inc_001',
    employeeId: 'emp_001',
    title: '中石化非油促销任务-7月',
    amount: 250,
    status: 'claimable',
    source: 'task',
    period: '2026-07',
    createdAt: '2026-07-26T16:30:00',
  },
  {
    id: 'inc_002',
    employeeId: 'emp_001',
    title: '中石化会员拉新任务奖励',
    amount: 70,
    status: 'claimable',
    source: 'task',
    period: '2026-07',
    createdAt: '2026-07-25T11:00:00',
  },
  {
    id: 'inc_003',
    employeeId: 'emp_001',
    title: '7月考勤计薪（中石化朝阳站预估）',
    amount: 7200,
    status: 'pending_settlement',
    source: 'attendance',
    period: '2026-07',
    createdAt: '2026-07-27T00:00:00',
  },
  {
    id: 'inc_004',
    employeeId: 'emp_001',
    title: '6月中石化综合收入',
    amount: 6850,
    tax: 205,
    netAmount: 6645,
    status: 'claimed',
    source: 'attendance',
    period: '2026-06',
    createdAt: '2026-07-05T10:00:00',
    claimedAt: '2026-07-06T09:30:00',
  },
  {
    id: 'inc_005',
    employeeId: 'emp_001',
    title: '中石化优秀灵工奖励',
    amount: 200,
    tax: 0,
    netAmount: 200,
    status: 'claimed',
    source: 'bonus',
    createdAt: '2026-06-20T10:00:00',
    claimedAt: '2026-06-21T14:00:00',
  },
]

export const seedMiniJobApplications: MiniJobApplication[] = [
  {
    id: 'mja_001',
    employeeId: 'emp_001',
    jobRequirementId: 'req_003',
    status: 'interview',
    interviewDate: '2026-07-30',
    interviewTime: '14:00',
    createdAt: '2026-07-20T10:00:00',
  },
  {
    id: 'mja_002',
    employeeId: 'emp_001',
    jobRequirementId: 'req_001',
    status: 'pending',
    createdAt: '2026-07-26T09:00:00',
  },
  {
    id: 'mja_003',
    employeeId: 'emp_001',
    jobRequirementId: 'req_002',
    status: 'rejected',
    reviewNote: '当前岗位已满员，建议关注其他站点',
    createdAt: '2026-07-15T10:00:00',
  },
]

export const seedWorkerAgreements: WorkerAgreement[] = [
  {
    id: 'agr_001',
    employeeId: 'emp_001',
    title: '灵活用工服务协议',
    content: '约定平台与灵工之间的权利义务、服务范围及结算方式。',
    signed: true,
    required: true,
    signedAt: '2026-01-15T10:00:00',
  },
  {
    id: 'agr_002',
    employeeId: 'emp_001',
    title: '个人信息授权书',
    content: '授权平台收集和使用个人信息用于实名认证及税务申报。',
    signed: true,
    required: true,
    signedAt: '2026-01-15T10:00:00',
  },
  {
    id: 'agr_003',
    employeeId: 'emp_001',
    title: '中石化安全生产承诺书',
    content: '承诺遵守中石化加油站安全生产规范，参加必要培训。',
    signed: false,
    required: true,
  },
]

export const seedWorkerPaymentBindings: WorkerPaymentBinding[] = [
  {
    employeeId: 'emp_001',
    alipay: '138****8821',
    bankName: '中国工商银行',
    bankCardLast4: '8890',
  },
]

export const seedWorkerProfileExts: WorkerProfileExt[] = [
  {
    employeeId: 'emp_001',
    level: '银牌灵工',
    levelScore: 68,
    creditScore: 92,
    creditLevel: '优秀',
    certificates: [
      { name: '中石化安全作业证', issuer: '中石化', expireAt: '2027-06-30' },
      { name: '普通话二级', issuer: '语言文字委员会', expireAt: '2028-12-31' },
    ],
  },
  {
    employeeId: 'emp_002',
    level: '金牌灵工',
    levelScore: 85,
    creditScore: 96,
    creditLevel: '优秀',
    certificates: [{ name: '中石化非油业务认证', issuer: '中石化', expireAt: '2027-03-15' }],
  },
]
