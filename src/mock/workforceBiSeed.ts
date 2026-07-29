export interface BiKpiItem {
  key: string
  label: string
  value: number | string
  suffix?: string
  trend?: number
  trendLabel?: string
  progress?: number
  color: 'blue' | 'green' | 'orange' | 'purple' | 'cyan' | 'red'
}

export interface BiDrillPerson {
  id: string
  name: string
  employeeNo: string
  department: string
  detail: string
  extra?: string
}

export interface CityHeat {
  name: string
  value: number
  coord: [number, number]
}

export interface RegionOnDuty {
  region: string
  count: number
}

export interface LiveFeed {
  id: string
  text: string
  time: string
}

export const cityHeatPoints: CityHeat[] = [
  { name: '上海', value: 1680, coord: [121.47, 31.23] },
  { name: '北京', value: 1520, coord: [116.4, 39.9] },
  { name: '深圳', value: 1350, coord: [114.05, 22.55] },
  { name: '广州', value: 1180, coord: [113.27, 23.13] },
  { name: '成都', value: 920, coord: [104.06, 30.67] },
  { name: '杭州', value: 780, coord: [120.15, 30.28] },
  { name: '武汉', value: 680, coord: [114.31, 30.59] },
  { name: '西安', value: 520, coord: [108.95, 34.27] },
]

export const regionOnDuty: RegionOnDuty[] = [
  { region: '华东', count: 1680 },
  { region: '华南', count: 1420 },
  { region: '华北', count: 1180 },
  { region: '华中', count: 980 },
  { region: '西南', count: 860 },
  { region: '西北', count: 520 },
  { region: '东北', count: 680 },
  { region: '港澳台', count: 320 },
]

export const liveFeeds: LiveFeed[] = [
  { id: '1', text: '生产一车间出勤率 96.2%，较昨日 +1.8%', time: '14:32' },
  { id: '2', text: '物流部连续3天缺卡预警 5 人，已推送主管', time: '14:28' },
  { id: '3', text: '今日自动投保 246 人次，保费合计 ¥861', time: '14:25' },
  { id: '4', text: '仓储网格零接单人员 12 人，占比 8.3%', time: '14:20' },
  { id: '5', text: '华东区在岗 1680 人，环比 +6.2%', time: '14:15' },
  { id: '6', text: '本月新入职 285 人，签约率 91.6%', time: '14:10' },
]

/** 1. 队伍状态 */
export const teamKpis: BiKpiItem[] = [
  { key: 'on_duty', label: '在岗总人数', value: 8932, trend: 8.3, trendLabel: '环比', color: 'blue' },
  { key: 'new_hire', label: '本月新入职', value: 285, trend: 12.5, trendLabel: '较上月', color: 'green' },
  { key: 'churn', label: '本月流失', value: 68, trend: -4.2, trendLabel: '流失率 2.4%', color: 'orange' },
  { key: 'sign_rate', label: '签约率', value: 91.6, suffix: '%', progress: 91.6, trend: 2.1, trendLabel: '较上月', color: 'purple' },
]

export const teamDeptHeadcount = [
  { name: '生产一车间', count: 486 },
  { name: '生产二车间', count: 428 },
  { name: '物流仓储', count: 379 },
  { name: '质检部', count: 312 },
  { name: '设备维护', count: 268 },
  { name: '行政后勤', count: 186 },
]

export const teamHireChurn12m = {
  labels: ['8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月'],
  hire: [220, 245, 238, 260, 275, 290, 268, 302, 285, 310, 295, 285],
  churn: [52, 48, 55, 62, 58, 65, 60, 72, 68, 70, 75, 68],
}

export const teamStatusPie = [
  { name: '在岗', value: 8932, color: '#5ad8a6' },
  { name: '休眠', value: 1240, color: '#f6bd16' },
  { name: '待签约', value: 680, color: '#e60012' },
  { name: '离职', value: 420, color: '#909399' },
]

export const teamTenureHist = [
  { name: '<1个月', value: 820 },
  { name: '1-3月', value: 2150 },
  { name: '3-6月', value: 2680 },
  { name: '6月-1年', value: 2420 },
  { name: '1年+', value: 860 },
]

/** 2. 考勤合规 */
export const attendanceKpis: BiKpiItem[] = [
  { key: 'today_rate', label: '今日实时出勤率', value: 94.6, suffix: '%', trend: 1.2, trendLabel: '较昨日', color: 'green' },
  { key: 'month_rate', label: '本月平均出勤率', value: 92.8, suffix: '%', trend: 0.8, trendLabel: '较上月', color: 'blue' },
  { key: 'late_early', label: '迟到早退人次', value: 156, trend: -6.5, trendLabel: '较上月', color: 'orange' },
  { key: 'missing_rate', label: '缺卡率', value: 3.2, suffix: '%', trend: -0.5, trendLabel: '较上月', color: 'red' },
]

export const attendanceDailyTrend = {
  labels: Array.from({ length: 26 }, (_, i) => `${i + 1}日`),
  rates: [91, 93, 92, 94, 93, 95, 94, 92, 93, 94, 95, 93, 92, 94, 95, 96, 94, 93, 95, 94, 93, 94, 95, 94, 96, 94.6],
}

export const attendanceDeptRank = [
  { name: '生产一车间', rate: 96.2 },
  { name: '质检部', rate: 94.8 },
  { name: '物流仓储', rate: 93.5 },
  { name: '设备维护', rate: 91.2 },
  { name: '行政后勤', rate: 88.6 },
  { name: '临时网格A', rate: 46.3 },
  { name: '临时网格B', rate: 42.1 },
]

export const attendanceLateHeat = {
  days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  depts: ['生产一车间', '物流仓储', '质检部'],
  data: [
    [0, 0, 8], [0, 1, 5], [0, 2, 6], [0, 3, 4], [0, 4, 7], [0, 5, 2], [0, 6, 1],
    [1, 0, 6], [1, 1, 4], [1, 2, 5], [1, 3, 8], [1, 4, 3], [1, 5, 1], [1, 6, 0],
    [2, 0, 3], [2, 1, 2], [2, 2, 4], [2, 3, 3], [2, 4, 5], [2, 5, 1], [2, 6, 0],
  ] as [number, number, number][],
}

export const trainingStats = { completionRate: 88.6, passRate: 94.2 }

export const missingPunchAlert = [
  { id: 'a1', name: '刘*军', employeeNo: 'LG10286', department: '物流仓储', detail: '连续缺卡 3 天', extra: '7/24-7/26' },
  { id: 'a2', name: '陈*明', employeeNo: 'LG10342', department: '临时网格A', detail: '连续缺卡 3 天', extra: '7/23-7/25' },
  { id: 'a3', name: '赵*芳', employeeNo: 'LG10401', department: '物流仓储', detail: '连续缺卡 4 天', extra: '7/22-7/25' },
]

/** 3. 薪酬保险 */
export const payrollKpis: BiKpiItem[] = [
  { key: 'payroll_total', label: '本月薪酬总额', value: 286.5, suffix: '万', trend: 5.2, trendLabel: '较上月', color: 'blue' },
  { key: 'platform_fee', label: '本月平台服务费', value: 18.6, suffix: '万', trend: 4.8, trendLabel: '较上月', color: 'purple' },
  { key: 'insurance_count', label: '本月投保总人次', value: 6248, trend: 8.1, trendLabel: '较上月', color: 'green' },
  { key: 'premium_total', label: '本月保费总额', value: 2.19, suffix: '万', trend: 7.5, trendLabel: '较上月', color: 'cyan' },
]

export const payrollTrend12m = {
  labels: ['8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月'],
  payroll: [228, 235, 242, 258, 265, 248, 252, 268, 275, 282, 278, 286.5],
  fee: [14.2, 14.8, 15.1, 15.8, 16.2, 15.5, 15.8, 16.5, 17.1, 17.8, 17.5, 18.6],
}

export const payrollDeptPie = [
  { name: '生产一车间', value: 86.2, color: '#e60012' },
  { name: '物流仓储', value: 62.5, color: '#5b8ff9' },
  { name: '质检部', value: 48.3, color: '#5ad8a6' },
  { name: '设备维护', value: 42.8, color: '#9270ca' },
  { name: '其他', value: 46.7, color: '#909399' },
]

export const insuranceDailyTrend = {
  labels: Array.from({ length: 26 }, (_, i) => `${i + 1}日`),
  counts: [180, 195, 210, 205, 220, 198, 215, 228, 232, 225, 240, 235, 218, 242, 248, 255, 238, 245, 250, 246, 252, 258, 245, 260, 255, 246],
}

export const claimStats = {
  count: 12,
  amount: 8.6,
  closeRate: 91.7,
  countTrend: -2,
  amountTrend: 5.3,
}

export const feeStacked = {
  labels: ['8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月'],
  base: [9.8, 10.2, 10.5, 11.0, 11.3, 10.8, 11.0, 11.5, 12.0, 12.4, 12.1, 12.8],
  manage: [4.4, 4.6, 4.6, 4.8, 4.9, 4.7, 4.8, 5.0, 5.1, 5.4, 5.4, 5.8],
}

/** 4. 任务活力 */
export const taskKpis: BiKpiItem[] = [
  { key: 'task_takers', label: '本月接单总人次', value: 4520, trend: 6.8, trendLabel: '较上月', color: 'blue' },
  { key: 'avg_tasks', label: '人均接单数', value: 3.2, trend: 0.4, trendLabel: '较上月', color: 'green' },
  { key: 'zero_task', label: '零接单人数', value: 186, trend: -8.2, trendLabel: '较上月', color: 'orange' },
  { key: 'complete_rate', label: '任务完成率', value: 87.3, suffix: '%', trend: 2.5, trendLabel: '较上月', color: 'purple' },
]

export const taskTypePie = [
  { name: '拣货分拣', value: 1280, color: '#e60012' },
  { name: '装卸搬运', value: 960, color: '#5b8ff9' },
  { name: '设备巡检', value: 620, color: '#5ad8a6' },
  { name: '清洁保洁', value: 480, color: '#9270ca' },
  { name: '其他', value: 340, color: '#909399' },
]

export const taskDailyActive = {
  labels: Array.from({ length: 26 }, (_, i) => `${i + 1}日`),
  counts: [320, 335, 342, 328, 350, 310, 298, 345, 352, 338, 360, 355, 340, 365, 370, 358, 345, 362, 368, 355, 350, 372, 365, 378, 360, 352],
}

export const taskCompleteRank = [
  { name: '生产一车间', rate: 92.5 },
  { name: '质检部', rate: 90.8 },
  { name: '设备维护', rate: 88.6 },
  { name: '物流仓储', rate: 86.2 },
  { name: '行政后勤', rate: 82.4 },
]

export const zeroTaskByDept = [
  { name: '临时网格A', count: 48, ratio: 32.4 },
  { name: '临时网格B', count: 36, ratio: 28.6 },
  { name: '行政后勤', count: 28, ratio: 15.1 },
  { name: '物流仓储', count: 22, ratio: 5.8 },
]

export const zeroTaskTwoMonthAlert = [
  { id: 'z1', name: '王*强', employeeNo: 'LG10520', department: '临时网格A', detail: '连续两月零接单', extra: '5月-7月' },
  { id: 'z2', name: '李*娜', employeeNo: 'LG10588', department: '临时网格B', detail: '连续两月零接单', extra: '5月-7月' },
  { id: 'z3', name: '张*伟', employeeNo: 'LG10602', department: '行政后勤', detail: '连续两月零接单', extra: '6月-7月' },
]

/** 下钻人员名单 */
export const drillLists: Record<string, BiDrillPerson[]> = {
  on_duty: [
    { id: 'd1', name: '张明', employeeNo: 'LG10001', department: '生产一车间', detail: '在岗', extra: '今日已打卡' },
    { id: 'd2', name: '李华', employeeNo: 'LG10002', department: '生产一车间', detail: '在岗', extra: '今日已打卡' },
    { id: 'd3', name: '王芳', employeeNo: 'LG10003', department: '物流仓储', detail: '在岗', extra: '今日已打卡' },
  ],
  new_hire: [
    { id: 'n1', name: '周杰', employeeNo: 'LG10801', department: '生产二车间', detail: '7/20 入职', extra: '已签约' },
    { id: 'n2', name: '吴敏', employeeNo: 'LG10802', department: '质检部', detail: '7/18 入职', extra: '已签约' },
  ],
  churn: [
    { id: 'c1', name: '孙磊', employeeNo: 'LG09820', department: '物流仓储', detail: '7/15 离职', extra: '个人原因' },
    { id: 'c2', name: '钱进', employeeNo: 'LG09786', department: '临时网格A', detail: '7/12 离职', extra: '合同到期' },
  ],
  sign_rate: [
    { id: 's1', name: '郑凯', employeeNo: 'LG10750', department: '设备维护', detail: '待签约', extra: '入职 5 天' },
    { id: 's2', name: '冯雪', employeeNo: 'LG10755', department: '行政后勤', detail: '待签约', extra: '入职 3 天' },
  ],
  today_rate: [
    { id: 't1', name: '张明', employeeNo: 'LG10001', department: '生产一车间', detail: '08:06 上班打卡', extra: '正常' },
    { id: 't2', name: '李华', employeeNo: 'LG10002', department: '生产一车间', detail: '08:12 上班打卡', extra: '迟到' },
  ],
  zero_task: [
    { id: 'zt1', name: '王*强', employeeNo: 'LG10520', department: '临时网格A', detail: '本月零接单', extra: '入职 4 月' },
    { id: 'zt2', name: '李*娜', employeeNo: 'LG10588', department: '临时网格B', detail: '本月零接单', extra: '入职 2 月' },
  ],
}
