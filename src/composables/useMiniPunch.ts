import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { AttendanceGroup, PunchMethod } from '@/types'
import type { useAppStore } from '@/stores/app'
import { MINIAPP_DEMO_ANCHOR_DATE } from '@/constants/miniapp'
import type { MiniPunchMethod } from '@/constants/miniapp'

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

export function getEmployeeAttendanceGroup(store: Store, employeeId: string): AttendanceGroup | null {
  const team = store.teams.find((t) => t.memberIds.includes(employeeId))
  if (!team?.attendanceGroupId) return null
  return store.attendanceGroups.find((g) => g.id === team.attendanceGroupId) ?? null
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
      address: loc.address ?? loc.name,
      lat: coords.lat,
      lng: coords.lng,
    }
  })
}

export function resolveAvailableMethods(group: AttendanceGroup | null): MiniPunchMethod[] {
  const methods: MiniPunchMethod[] = []
  if (group?.gpsEnabled !== false) methods.push('gps')
  if (group?.wifiEnabled) methods.push('wifi')
  methods.push('field')
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

export function useMiniPunchWifi(group: AttendanceGroup | null) {
  const demoNetworks = [
    { ssid: group?.wifiName ?? 'ShiftStore-5G', matched: true },
    { ssid: 'ChinaNet-Office', matched: false },
    { ssid: 'CMCC-Guest', matched: false },
  ]
  const connectedSsid = ref(group?.wifiName ?? 'ShiftStore-5G')
  const wifiMatched = computed(
    () => group?.wifiEnabled && connectedSsid.value === group.wifiName,
  )

  function rescanWifi() {
    connectedSsid.value = group?.wifiName ?? 'ShiftStore-5G'
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
