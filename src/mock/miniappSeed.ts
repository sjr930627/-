import type {
  MiniAppMessage,
  MiniJobApplication,
  WorkerAgreement,
  WorkerIncomeDetailItem,
  WorkerIncomeRecord,
  WorkerPaymentBinding,
  WorkerProfileExt,
} from '@/types'

function hourlyItem(
  id: string,
  title: string,
  date: string,
  hours: number,
  rate: number,
): WorkerIncomeDetailItem {
  return {
    id,
    title,
    date,
    unitPrice: rate,
    quantity: hours,
    calcType: 'hourly',
    amount: hours * rate,
  }
}

function taskItem(
  id: string,
  title: string,
  date: string,
  count: number,
  unitPrice: number,
): WorkerIncomeDetailItem {
  return {
    id,
    title,
    date,
    unitPrice,
    quantity: count,
    calcType: 'task',
    amount: count * unitPrice,
  }
}

function sumItems(items: WorkerIncomeDetailItem[]) {
  return items.reduce((s, i) => s + i.amount, 0)
}

export const seedMiniAppMessages: MiniAppMessage[] = [
  {
    id: 'msg_001',
    employeeId: 'emp_001',
    category: 'schedule',
    actionType: 'schedule_confirm',
    title: '您已被指派【售后组】中班 2026-07-28',
    content: '班次：【售后组】中班 · 7月28日 14:00-22:00，请确认是否可出勤。',
    read: false,
    createdAt: '2026-07-27T09:30:00',
    scheduleDetail: {
      enterpriseName: '中石化朝阳加油站',
      groupName: '售后组',
      shiftLabel: '中班',
      shiftTime: '14:00-22:00',
      date: '2026-07-28',
      hourlyRate: 25,
      confirmBefore: '2026-07-27T23:59:00',
      confirmStatus: 'pending',
    },
  },
  {
    id: 'msg_002',
    employeeId: 'emp_001',
    category: 'income',
    title: '您的日结工资已到账',
    content: '7月27日 中石化朝阳站 早班收入 ¥225 已结算，可前往领取。',
    read: false,
    createdAt: '2026-07-27T08:15:00',
  },
  {
    id: 'msg_003',
    employeeId: 'emp_001',
    category: 'system',
    actionType: 'agreement',
    title: '服务协议更新提醒',
    content: '《灵工平台服务协议》已更新，请阅读并确认后继续接单。',
    read: false,
    createdAt: '2026-07-26T18:00:00',
    agreementId: 'agr_001',
  },
  {
    id: 'msg_004',
    employeeId: 'emp_001',
    category: 'schedule',
    actionType: 'schedule_info',
    title: '明日排班提醒',
    content: '您明日（7月28日）中石化朝阳站排班为早班 08:00-16:00，请准时到岗。',
    read: false,
    createdAt: '2026-07-26T17:30:00',
  },
  {
    id: 'msg_005',
    employeeId: 'emp_001',
    category: 'income',
    title: '收入可领取',
    content: '您有 2 笔中石化任务收入共计 ¥320 可领取，请及时操作。',
    read: false,
    createdAt: '2026-07-26T09:00:00',
  },
  {
    id: 'msg_006',
    employeeId: 'emp_001',
    category: 'task',
    actionType: 'info',
    title: '任务审核通过',
    content: '「中石化非油促销-202607」任务已审核通过，收入将计入待领取。',
    read: true,
    createdAt: '2026-07-26T16:30:00',
  },
  {
    id: 'msg_007',
    employeeId: 'emp_001',
    category: 'withdraw',
    title: '提现成功',
    content: '您于 7月25日 提现 ¥1,850.00 已到账支付宝。',
    read: true,
    createdAt: '2026-07-25T14:20:00',
  },
  {
    id: 'msg_008',
    employeeId: 'emp_001',
    category: 'system',
    actionType: 'info',
    title: '培训课程提醒',
    content: '「中石化新入职安全合规必修课」尚未完成，请尽快学习。',
    read: true,
    createdAt: '2026-07-24T10:00:00',
  },
  {
    id: 'msg_009',
    employeeId: 'emp_001',
    category: 'schedule',
    actionType: 'schedule_info',
    title: '排班变更通知',
    content: '7月29日 中班已调整为 13:00-21:00，请留意最新排班。',
    read: true,
    createdAt: '2026-07-23T11:20:00',
  },
  {
    id: 'msg_010',
    employeeId: 'emp_001',
    category: 'income',
    title: '激励金发放',
    content: '本月满勤激励 ¥200 已发放，可在收入明细中查看。',
    read: true,
    createdAt: '2026-07-22T09:00:00',
  },
  {
    id: 'msg_011',
    employeeId: 'emp_001',
    category: 'system',
    actionType: 'info',
    title: '账号安全提醒',
    content: '您的登录设备发生变更，如非本人操作请及时修改密码。',
    read: true,
    createdAt: '2026-07-14T15:20:00',
  },
  {
    id: 'msg_012',
    employeeId: 'emp_001',
    category: 'schedule',
    actionType: 'schedule_info',
    title: '抢班报名已通过',
    content: '您申请的 7月30日 夜班班次已审核通过，已写入排班表。',
    read: true,
    createdAt: '2026-07-14T10:05:00',
  },
]

export const seedWorkerIncomeRecords: WorkerIncomeRecord[] = (() => {
  const inc001Items = [
    taskItem('inc_001_d1', '非油促销任务', '2026-07-24', 5, 50),
  ]
  const inc002Items = [
    taskItem('inc_002_d1', '会员拉新任务', '2026-07-23', 2, 35),
  ]
  const inc003Items = [
    hourlyItem('inc_003_d1', '中石化朝阳站 白班', '2026-07-22', 8, 25),
    hourlyItem('inc_003_d2', '中石化朝阳站 夜班', '2026-07-23', 8, 30),
    hourlyItem('inc_003_d3', '中石化朝阳站 白班', '2026-07-24', 8, 25),
    hourlyItem('inc_003_d4', '中石化朝阳站 白班', '2026-07-25', 8, 25),
    hourlyItem('inc_003_d5', '中石化朝阳站 夜班', '2026-07-26', 8, 30),
    hourlyItem('inc_003_d6', '中石化朝阳站 白班', '2026-07-27', 8, 25),
    hourlyItem('inc_003_d7', '中石化朝阳站 白班', '2026-07-28', 8, 25),
    hourlyItem('inc_003_d8', '中石化朝阳站 夜班', '2026-07-29', 8, 30),
  ]
  const inc006Items = [
    taskItem('inc_006_d1', '便利店理货任务', '2026-07-20', 6, 45),
    taskItem('inc_006_d2', '加油引导任务', '2026-07-21', 4, 55),
    taskItem('inc_006_d3', '会员拉新任务', '2026-07-22', 1, 50),
  ]
  const inc004Items = [
    hourlyItem('inc_004_d1', '中石化朝阳站 白班', '2026-06-03', 8, 25),
    hourlyItem('inc_004_d2', '中石化朝阳站 白班', '2026-06-04', 8, 25),
    hourlyItem('inc_004_d3', '中石化朝阳站 夜班', '2026-06-05', 8, 30),
    hourlyItem('inc_004_d4', '中石化朝阳站 白班', '2026-06-06', 8, 25),
    hourlyItem('inc_004_d5', '中石化朝阳站 白班', '2026-06-10', 8, 25),
    hourlyItem('inc_004_d6', '中石化朝阳站 夜班', '2026-06-11', 8, 30),
    hourlyItem('inc_004_d7', '中石化朝阳站 白班', '2026-06-12', 8, 25),
    hourlyItem('inc_004_d8', '中石化朝阳站 白班', '2026-06-17', 8, 25),
    hourlyItem('inc_004_d9', '中石化朝阳站 夜班', '2026-06-18', 8, 30),
    hourlyItem('inc_004_d10', '中石化朝阳站 白班', '2026-06-19', 8, 25),
    hourlyItem('inc_004_d11', '中石化朝阳站 白班', '2026-06-24', 8, 25),
    hourlyItem('inc_004_d12', '中石化朝阳站 夜班', '2026-06-25', 8, 30),
  ]
  const inc004Amount = sumItems(inc004Items)
  const inc004Tax = Math.round(inc004Amount * 0.03 * 100) / 100
  const inc005Items = [
    taskItem('inc_005_d1', '优秀灵工奖励', '2026-06-20', 1, 200),
  ]

  return [
    {
      id: 'inc_001',
      employeeId: 'emp_001',
      title: '中石化非油促销任务-7月',
      amount: sumItems(inc001Items),
      status: 'claimable',
      source: 'task',
      period: '2026-07',
      createdAt: '2026-07-26T16:30:00',
      items: inc001Items,
    },
    {
      id: 'inc_002',
      employeeId: 'emp_001',
      title: '中石化会员拉新任务奖励',
      amount: sumItems(inc002Items),
      status: 'claimable',
      source: 'task',
      period: '2026-07',
      createdAt: '2026-07-25T11:00:00',
      items: inc002Items,
    },
    {
      id: 'inc_003',
      employeeId: 'emp_001',
      title: '7月考勤计薪（中石化朝阳站预估）',
      amount: sumItems(inc003Items),
      status: 'pending_settlement',
      source: 'attendance',
      period: '2026-07',
      createdAt: '2026-07-27T00:00:00',
      items: inc003Items,
    },
    {
      id: 'inc_006',
      employeeId: 'emp_001',
      title: '7月任务计薪（待结算）',
      amount: sumItems(inc006Items),
      status: 'pending_settlement',
      source: 'task',
      period: '2026-07',
      createdAt: '2026-07-27T08:00:00',
      items: inc006Items,
    },
    {
      id: 'inc_004',
      employeeId: 'emp_001',
      title: '6月中石化考勤收入',
      amount: inc004Amount,
      tax: inc004Tax,
      netAmount: Math.round((inc004Amount - inc004Tax) * 100) / 100,
      status: 'claimed',
      source: 'attendance',
      period: '2026-06',
      createdAt: '2026-07-05T10:00:00',
      claimedAt: '2026-07-06T09:30:00',
      claimBatchId: 'claim_001',
      items: inc004Items,
    },
    {
      id: 'inc_005',
      employeeId: 'emp_001',
      title: '中石化优秀灵工奖励',
      amount: sumItems(inc005Items),
      tax: 0,
      netAmount: 200,
      status: 'claimed',
      source: 'bonus',
      createdAt: '2026-06-20T10:00:00',
      claimedAt: '2026-06-21T14:00:00',
      claimBatchId: 'claim_002',
      items: inc005Items,
    },
  ]
})()

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
    faceVerifyStatus: 'verified',
    faceVerifiedAt: '2026-07-15T09:20:00',
    schedulePreferences: [
      {
        id: 'sp_001',
        weekdays: ['周二', '周三', '周四'],
        startTime: '09:00',
        endTime: '21:00',
        variant: 'weekday',
      },
      {
        id: 'sp_002',
        weekdays: ['周六'],
        startTime: '09:00',
        endTime: '21:00',
        variant: 'weekend',
      },
    ],
    partTimePreference: {},
    basicProofs: [
      { type: 'real_name', status: 'missing' },
      { type: 'health_cert', status: 'missing' },
    ],
    skillCertificates: [],
    profileCompleteness: 20,
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
