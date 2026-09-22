import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { AttendanceGroup, PunchMethod } from '@/types'
import type { useAppStore } from '@/stores/app'
import { MINIAPP_DEMO_ANCHOR_DATE } from '@/constants/miniapp'
import type { MiniPunchMethod } from '@/constants/miniapp'
import { formatPunchLocationAddress } from '@/constants/region'

type Store = ReturnType<typeof useAppStore>

export interface PunchTarget {
  id: string
  name: string
  address: string
  lat: number
  lng: number
}

/** Demo 打卡坐标（中国移动朝阳营业厅） */
export const DEMO_PUNCH_COORDS = {
  lat: 39.9928,
  lng: 116.4815,
  address: '北京市朝阳区望京西路88号中国移动朝阳营业厅',
}

const TARGET_COORDS: Record<string, { lat: number; lng: number }> = {
  loc_factory: { lat: 30.2812, lng: 120.1628 },
  loc_hz_store: { lat: 30.2741, lng: 120.1551 },
  loc_hq: { lat: 39.9042, lng: 116.4074 },
  loc_rd: { lat: 39.9833, lng: 116.3167 },
  loc_log: { lat: 30.265, lng: 120.14 },
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export type MiniPunchMode = 'shift' | 'free'

export interface EmployeePunchModes {
  modes: MiniPunchMode[]
  hasShift: boolean
  hasFree: boolean
  shiftGroup: AttendanceGroup | null
  freeGroup: AttendanceGroup | null
  /** 仅一种时为该模式；两种时默认班次（有班次组）否则自由 */
  defaultMode: MiniPunchMode | null
}

/** 员工所属全部考勤组（按团队去重） */
export function getEmployeeAttendanceGroups(store: Store, employeeId: string): AttendanceGroup[] {
  const teams = store.teams.filter((t) => t.memberIds.includes(employeeId))
  const seen = new Set<string>()
  const groups: AttendanceGroup[] = []
  for (const team of teams) {
    if (!team.attendanceGroupId || seen.has(team.attendanceGroupId)) continue
    const g = store.attendanceGroups.find((ag) => ag.id === team.attendanceGroupId)
    if (!g) continue
    seen.add(g.id)
    groups.push(g)
  }
  return groups
}

export function getEmployeePunchModes(store: Store, employeeId: string): EmployeePunchModes {
  const groups = getEmployeeAttendanceGroups(store, employeeId)
  const shiftGroup = groups.find((g) => g.attendanceType === 'shift') ?? null
  const freeGroup = groups.find((g) => g.attendanceType === 'free') ?? null
  const modes: MiniPunchMode[] = []
  if (shiftGroup) modes.push('shift')
  if (freeGroup) modes.push('free')
  const defaultMode: MiniPunchMode | null = shiftGroup ? 'shift' : freeGroup ? 'free' : null
  return {
    modes,
    hasShift: Boolean(shiftGroup),
    hasFree: Boolean(freeGroup),
    shiftGroup,
    freeGroup,
    defaultMode,
  }
}

export function resolveAttendanceGroupByMode(
  store: Store,
  employeeId: string,
  mode: MiniPunchMode | null | undefined,
): AttendanceGroup | null {
  const punchModes = getEmployeePunchModes(store, employeeId)
  if (mode === 'free' && punchModes.freeGroup) return punchModes.freeGroup
  if (mode === 'shift' && punchModes.shiftGroup) return punchModes.shiftGroup
  if (punchModes.defaultMode === 'free') return punchModes.freeGroup
  if (punchModes.defaultMode === 'shift') return punchModes.shiftGroup
  return getEmployeeAttendanceGroup(store, employeeId)
}

export function getEmployeeAttendanceGroup(store: Store, employeeId: string): AttendanceGroup | null {
  const emp = store.employees.find((e) => e.id === employeeId)
  const teams = store.teams.filter((t) => t.memberIds.includes(employeeId))
  if (!teams.length) return null
  const preferred =
    teams.find((t) => emp?.departmentId && t.departmentId === emp.departmentId) ??
    teams.find((t) => {
      const g = store.attendanceGroups.find((ag) => ag.id === t.attendanceGroupId)
      return g?.attendanceType === 'free'
    }) ??
    teams[0]
  if (!preferred?.attendanceGroupId) return null
  return store.attendanceGroups.find((g) => g.id === preferred.attendanceGroupId) ?? null
}

export function isFreePunchGroup(group: AttendanceGroup | null | undefined) {
  return group?.attendanceType === 'free'
}

export function isNoPunchGroup(group: AttendanceGroup | null | undefined) {
  return group?.attendanceType === 'none'
}

export function isFreeClockInOnly(group: AttendanceGroup | null | undefined) {
  return isFreePunchGroup(group) && group?.freePunchConfig?.punchCountMode === 'clock_in_only'
}

export function freePunchDefaultMinutes(group: AttendanceGroup | null | undefined) {
  const hours = group?.freePunchConfig?.defaultWorkHours ?? 8
  return Math.max(1, hours) * 60
}

export function freePunchWindowLabel(group: AttendanceGroup | null | undefined) {
  const cfg = group?.freePunchConfig
  if (!cfg) return '自由打卡 · 无班次'
  return `自由打卡 · ${cfg.startTime.slice(0, 5)}-${cfg.endTime.slice(0, 5)}`
}

export interface FreePunchDepartmentOption {
  id: string
  name: string
}

/** 自由打卡组关联部门（多部门时需下拉选择） */
export function getFreePunchDepartmentOptions(
  store: Store,
  employeeId: string,
  freeGroup?: AttendanceGroup | null,
): FreePunchDepartmentOption[] {
  const group = freeGroup ?? getEmployeePunchModes(store, employeeId).freeGroup
  if (!group) return []

  const byId = new Map<string, string>()
  for (const b of group.departmentBindings ?? []) {
    if (b.departmentId) byId.set(b.departmentId, b.departmentName || b.departmentId)
  }
  // 补充：员工所在、且挂该自由打卡组的班组部门
  store.teams
    .filter((t) => t.memberIds.includes(employeeId) && t.attendanceGroupId === group.id)
    .forEach((t) => {
      if (!t.departmentId || byId.has(t.departmentId)) return
      const name = store.departments.find((d) => d.id === t.departmentId)?.name ?? t.departmentId
      byId.set(t.departmentId, name)
    })

  return Array.from(byId.entries()).map(([id, name]) => ({ id, name }))
}

export function pickDefaultFreePunchDepartmentId(
  store: Store,
  employeeId: string,
  options: FreePunchDepartmentOption[],
): string | null {
  if (!options.length) return null
  const emp = store.employees.find((e) => e.id === employeeId)
  if (emp?.departmentId && options.some((o) => o.id === emp.departmentId)) {
    return emp.departmentId
  }
  return options[0]?.id ?? null
}

export function buildPunchTargets(group: AttendanceGroup | null): PunchTarget[] {
  if (!group?.punchLocations.length) {
    return [
      {
        id: 'demo_store',
        name: '中国移动朝阳营业厅',
        address: DEMO_PUNCH_COORDS.address,
        lat: DEMO_PUNCH_COORDS.lat,
        lng: DEMO_PUNCH_COORDS.lng,
      },
    ]
  }
  return group.punchLocations.map((loc) => {
    const coords = TARGET_COORDS[loc.id] ?? DEMO_PUNCH_COORDS
    return {
      id: loc.id,
      name: loc.name,
      address: formatPunchLocationAddress(loc),
      lat: coords.lat,
      lng: coords.lng,
    }
  })
}

export function resolveAvailableMethods(group: AttendanceGroup | null): MiniPunchMethod[] {
  const methods: MiniPunchMethod[] = []
  if (group?.gpsEnabled !== false) methods.push('gps')
  if (group?.wifiEnabled) methods.push('wifi')
  if (group?.qrcodeEnabled) methods.push('qrcode')
  return methods
}

export function useMiniPunchLocation() {
  const locating = ref(false)
  const lat = ref(DEMO_PUNCH_COORDS.lat)
  const lng = ref(DEMO_PUNCH_COORDS.lng)
  const address = ref(DEMO_PUNCH_COORDS.address)
  const locateError = ref('')

  function applyDemoCoords() {
    lat.value = DEMO_PUNCH_COORDS.lat
    lng.value = DEMO_PUNCH_COORDS.lng
    address.value = DEMO_PUNCH_COORDS.address
  }

  function refreshLocation() {
    locating.value = true
    locateError.value = ''
    if (!navigator.geolocation) {
      applyDemoCoords()
      locating.value = false
      locateError.value = '浏览器不支持定位，已使用演示位置'
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lat.value = pos.coords.latitude
        lng.value = pos.coords.longitude
        address.value = `已定位 (${lat.value.toFixed(4)}, ${lng.value.toFixed(4)})`
        locating.value = false
      },
      () => {
        applyDemoCoords()
        locating.value = false
        locateError.value = '定位失败，已切换为演示位置（中国移动朝阳营业厅）'
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  onMounted(refreshLocation)

  return { locating, lat, lng, address, locateError, refreshLocation }
}

export function useMiniPunchWifi(groupSource: AttendanceGroup | null | (() => AttendanceGroup | null)) {
  const resolveGroup = () =>
    typeof groupSource === 'function' ? groupSource() : groupSource
  const demoNetworks = computed(() => {
    const group = resolveGroup()
    return [
      { ssid: group?.wifiName ?? 'ShiftStore-5G', matched: true },
      { ssid: 'ChinaNet-Office', matched: false },
      { ssid: 'CMCC-Guest', matched: false },
    ]
  })
  const connectedSsid = ref(resolveGroup()?.wifiName ?? 'ShiftStore-5G')
  const wifiMatched = computed(() => {
    const group = resolveGroup()
    return Boolean(group?.wifiEnabled && connectedSsid.value === group.wifiName)
  })

  function rescanWifi() {
    connectedSsid.value = resolveGroup()?.wifiName ?? 'ShiftStore-5G'
  }

  return { demoNetworks, connectedSsid, wifiMatched, rescanWifi }
}

export function calcNearestTarget(
  targets: PunchTarget[],
  lat: number,
  lng: number,
  radiusMeters: number,
) {
  let nearest: (PunchTarget & { distance: number }) | null = null
  for (const t of targets) {
    const distance = Math.round(haversineMeters(lat, lng, t.lat, t.lng))
    if (!nearest || distance < nearest.distance) {
      nearest = { ...t, distance }
    }
  }
  const inRange = nearest ? nearest.distance <= radiusMeters : false
  return { nearest, inRange }
}

export function localDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function createMiniPunchNow() {
  const real = new Date()
  const [y, m, d] = MINIAPP_DEMO_ANCHOR_DATE.split('-').map(Number)
  return new Date(y, m - 1, d, real.getHours(), real.getMinutes(), real.getSeconds())
}

export function useMiniPunchClock() {
  const now = ref(createMiniPunchNow())
  let timer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    timer = setInterval(() => {
      now.value = createMiniPunchNow()
    }, 1000)
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })
  return { now }
}

export function buildPunchLocationLabel(
  method: PunchMethod,
  targetName: string | undefined,
  address: string,
) {
  const prefix =
    method === 'gps'
      ? '定位'
      : method === 'wifi'
        ? 'WiFi'
        : method === 'field'
          ? '外勤'
          : '扫码'
  const place = targetName ? `${targetName} · ${address}` : address
  return `${prefix} · ${place}`
}
