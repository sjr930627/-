export interface WorkforceKpi {
  label: string
  value: number | string
  suffix?: string
  trend: number
  trendLabel: string
  color: 'blue' | 'green' | 'orange' | 'purple' | 'cyan'
}

export interface RegionOnDuty {
  region: string
  count: number
}

export interface StoreRank {
  rank: number
  name: string
  count: number
}

export interface CityHeat {
  name: string
  value: number
  coord: [number, number]
}

export interface FunnelStep {
  label: string
  value: number
  rate?: string
}

export interface StoreConversion {
  name: string
  rate: number
}

export interface LiveFeed {
  id: string
  text: string
  time: string
}

export const workforceKpis: WorkforceKpi[] = [
  { label: '总注册员工数', value: 128456, trend: 12.5, trendLabel: '较上月', color: 'blue' },
  { label: '今日在岗人数', value: 8932, trend: 8.3, trendLabel: '较昨日', color: 'green' },
  { label: '今日报名人数', value: 3215, trend: -3.2, trendLabel: '较昨日', color: 'orange' },
  { label: '报名到岗转化率', value: 76.8, suffix: '%', trend: 2.1, trendLabel: '较上周', color: 'purple' },
  { label: '复报率', value: 42.3, suffix: '%', trend: 5.7, trendLabel: '较上月', color: 'cyan' },
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

export const storeTop10: StoreRank[] = [
  { rank: 1, name: '上海浦东旗舰店', count: 486 },
  { rank: 2, name: '北京朝阳CBD店', count: 428 },
  { rank: 3, name: '深圳南山科技园店', count: 379 },
  { rank: 4, name: '广州天河城店', count: 340 },
  { rank: 5, name: '杭州西湖银泰店', count: 312 },
  { rank: 6, name: '成都春熙路店', count: 286 },
  { rank: 7, name: '武汉光谷店', count: 268 },
  { rank: 8, name: '南京新街口店', count: 218 },
  { rank: 9, name: '重庆解放碑店', count: 186 },
  { rank: 10, name: '西安钟楼店', count: 146 },
]

export const cityHeatPoints: CityHeat[] = [
  { name: '上海', value: 1680, coord: [121.47, 31.23] },
  { name: '北京', value: 1520, coord: [116.4, 39.9] },
  { name: '深圳', value: 1350, coord: [114.05, 22.55] },
  { name: '广州', value: 1180, coord: [113.27, 23.13] },
  { name: '成都', value: 920, coord: [104.06, 30.67] },
  { name: '杭州', value: 780, coord: [120.15, 30.28] },
]

export const trend30Days = {
  labels: [
    '12/17', '12/20', '12/23', '12/26', '12/29', '01/01', '01/04',
    '01/07', '01/10', '01/13', '01/15',
  ],
  applicants: [1820, 1950, 2080, 2150, 2280, 2420, 2560, 2680, 2850, 2980, 3215],
  onDuty: [1380, 1480, 1560, 1620, 1710, 1820, 1930, 2050, 2180, 2310, 2468],
}

export const conversionFunnel: FunnelStep[] = [
  { label: '总报名人数', value: 12580 },
  { label: '审核通过', value: 10862, rate: '86.3%' },
  { label: '已到岗', value: 9658, rate: '76.8%' },
  { label: '完成服务', value: 8892, rate: '70.7%' },
]

export const storeConversionRates: StoreConversion[] = [
  { name: '上海浦东旗舰店', rate: 90.3 },
  { name: '北京朝阳CBD店', rate: 87.8 },
  { name: '深圳南山科技园店', rate: 85.6 },
  { name: '广州天河城店', rate: 83.2 },
  { name: '杭州西湖银泰店', rate: 81.5 },
  { name: '成都春熙路店', rate: 79.8 },
  { name: '武汉光谷店', rate: 78.4 },
  { name: '南京新街口店', rate: 76.9 },
]

export const reapplyStats = {
  rate: 42.3,
  reapplyCount: 3762,
  totalOnDuty: 8892,
  avgTimes: 2.8,
  medianDays: 15,
}

export const liveFeeds: LiveFeed[] = [
  { id: '1', text: '上海浦东旗舰店 张*明 完成报名→到岗，转化耗时 2.3 小时', time: '14:28' },
  { id: '2', text: '北京朝阳CBD店 李*华 第5次报岗成功，累计服务 12 次', time: '14:25' },
  { id: '3', text: '深圳南山科技园店 今日报名人数突破 150 人，到岗率 88%', time: '14:20' },
  { id: '4', text: '广州天河城店 王*芳 复报成功，距上次服务 12 天', time: '14:15' },
  { id: '5', text: '杭州西湖银泰店 今日在岗 312 人，较昨日 +6.2%', time: '14:10' },
  { id: '6', text: '成都春熙路店 周*强 审核通过，预计 1 小时内到岗', time: '14:06' },
]
