import { attendanceGroupTypeMap } from '@/constants/attendanceGroup'
import { formatDayShiftPeriod, formatNightShiftPeriod } from '@/constants/attendanceGroupPricing'
import type {
  AttendanceGroup,
  AttendanceGroupVersion,
  AttendanceGroupVersionSnapshot,
} from '@/types'
import { generateId } from '@/utils'

export function createSnapshotFromGroup(
  group: AttendanceGroup | AttendanceGroupVersionSnapshot,
): AttendanceGroupVersionSnapshot {
  const snapshot = JSON.parse(JSON.stringify(group)) as AttendanceGroupVersionSnapshot
  if (snapshot.attendanceType === 'none') {
    delete snapshot.pricingConfig
  }
  if (snapshot.attendanceType !== 'free') {
    delete snapshot.freePunchConfig
  }
  return snapshot
}

export function ensureGroupVersions(group: AttendanceGroup): AttendanceGroup {
  if (group.versions?.length) {
    return {
      ...group,
      currentVersion: group.currentVersion ?? group.versions.find((v) => v.isActive)?.version ?? 0,
      versions: group.versions,
    }
  }
  const snapshot = createSnapshotFromGroup(group)
  const version: AttendanceGroupVersion = {
    id: generateId('agv'),
    version: 1,
    isActive: true,
    publishedAt: group.updatedAt || group.createdAt,
    changeNote: '初始版本',
    snapshot,
  }
  return {
    ...group,
    currentVersion: 1,
    versions: [version],
  }
}

export function formatVersionLabel(version: number): string {
  return version > 0 ? `V${version}` : '未发布'
}

export function formatVersionTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function summarizeVersionSnapshot(snapshot: AttendanceGroupVersionSnapshot): string[] {
  const lines: string[] = [
    `考勤类型：${attendanceGroupTypeMap[snapshot.attendanceType]}`,
    `状态：${snapshot.status === 'enabled' ? '启用' : '停用'}`,
  ]

  if (snapshot.attendanceType === 'shift' && snapshot.shiftTemplates.length) {
    lines.push(
      `班次：${snapshot.shiftTemplates.map((s) => `${s.name}(${s.startTime}-${s.endTime})`).join('、')}`,
    )
    lines.push(
      `合规红线：日${snapshot.compliance.maxDailyHours}h / 周${snapshot.compliance.maxWeeklyHours}h / 月${snapshot.compliance.maxMonthlyHours}h`,
    )
    if (snapshot.minMonthlyOnlineHours) {
      lines.push(`月最低在线：${snapshot.minMonthlyOnlineHours}h`)
    }
  }

  if (snapshot.attendanceType === 'free' && snapshot.freePunchConfig) {
    const fp = snapshot.freePunchConfig
    const modeLabel = fp.punchCountMode === 'clock_in_only' ? '仅上班打卡' : '上下班打卡'
    lines.push(`打卡时段：${fp.startTime}-${fp.endTime} · ${modeLabel}`)
    if (fp.punchCountMode === 'clock_in_only' && fp.defaultWorkHours != null) {
      lines.push(`默认工时：${fp.defaultWorkHours} 小时`)
    }
  }

  if (snapshot.attendanceType !== 'none') {
    const methods: string[] = []
    if (snapshot.gpsEnabled) methods.push(`GPS(${snapshot.gpsRadiusMeters}m)`)
    if (snapshot.wifiEnabled) methods.push('WiFi')
    if (snapshot.qrcodeEnabled) methods.push('扫码')
    lines.push(`考勤方式：${methods.join('、') || '—'}`)
  }

  if (snapshot.pricingConfig) {
    const p = snapshot.pricingConfig
    lines.push(
      `定价：白班 ${formatDayShiftPeriod(p.dayShiftPeriod)} ${p.dayShiftRate}元/h，夜班 ${formatNightShiftPeriod(p.nightShiftPeriod)} ${p.nightShiftRate}元/h`,
    )
  }

  lines.push(`关联部门：${snapshot.departmentBindings.map((b) => b.departmentName).join('、') || '—'}`)

  return lines
}

export function buildVersionRecord(
  group: AttendanceGroup,
  version: number,
  changeNote?: string,
): AttendanceGroupVersion {
  return {
    id: generateId('agv'),
    version,
    isActive: true,
    publishedAt: new Date().toISOString(),
    changeNote: changeNote || '配置发布',
    snapshot: createSnapshotFromGroup(group),
  }
}
