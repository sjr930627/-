import { computed, ref } from 'vue'
import type { MiniAppAccount, MiniAppSession } from '@/types'
import { useAppStore } from '@/stores/app'
import { MINIAPP_DEMO_PASSWORD } from '@/constants/miniappAuth'
import { seedWorkerProfileExts } from '@/mock/miniappSeed'

export const SESSION_KEY = 'miniapp:session'
export const ACCOUNTS_KEY = 'miniapp:accounts'
export const EMPLOYEE_KEY = 'miniapp:employeeId'

function loadAccounts(): MiniAppAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    return raw ? (JSON.parse(raw) as MiniAppAccount[]) : []
  } catch {
    return []
  }
}

function saveAccounts(accounts: MiniAppAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

export function readMiniAppSession(): MiniAppSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as MiniAppSession) : null
  } catch {
    return null
  }
}

function writeSession(session: MiniAppSession | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(EMPLOYEE_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  localStorage.setItem(EMPLOYEE_KEY, session.employeeId)
}

function resolveOnboardingComplete(employeeId: string): boolean {
  const store = useAppStore()
  const fromStore = store.workerProfileExts.find((p) => p.employeeId === employeeId)
  const fromSeed = seedWorkerProfileExts.find((p) => p.employeeId === employeeId)
  const profile = fromStore ?? fromSeed
  if (!profile) return false
  const merged = { ...fromSeed, ...fromStore, ...profile }
  const realNameOk =
    merged.basicProofs?.find((p) => p.type === 'real_name')?.status === 'verified'
  const faceOk = merged.faceVerifyStatus === 'verified'
  const addressOk = Boolean(merged.permanentAddress?.trim())
  return Boolean(realNameOk && faceOk && addressOk)
}

export function isMiniAppAuthed(): boolean {
  return Boolean(readMiniAppSession()?.employeeId)
}

export function isMiniAppOnboardingComplete(): boolean {
  const session = readMiniAppSession()
  if (!session) return false
  return session.onboardingComplete || resolveOnboardingComplete(session.employeeId)
}

export function useMiniAppAuth() {
  const store = useAppStore()
  const session = ref<MiniAppSession | null>(readMiniAppSession())

  const employeeId = computed(() => session.value?.employeeId ?? '')
  const isAuthed = computed(() => Boolean(session.value?.employeeId))
  const onboardingComplete = computed(
    () => session.value?.onboardingComplete || resolveOnboardingComplete(employeeId.value),
  )

  function syncSession() {
    session.value = readMiniAppSession()
  }

  function setSession(next: MiniAppSession) {
    session.value = next
    writeSession(next)
  }

  function login(phone: string, password: string) {
    const normalizedPhone = phone.trim()
    if (!normalizedPhone || !password) throw new Error('请输入手机号和密码')

    const accounts = loadAccounts()
    let account = accounts.find((a) => a.phone === normalizedPhone)

    if (!account) {
      const employee = store.employees.find((e) => e.phone === normalizedPhone)
      if (employee && password === MINIAPP_DEMO_PASSWORD) {
        account = { phone: normalizedPhone, password, employeeId: employee.id }
        accounts.push(account)
        saveAccounts(accounts)
      }
    }

    if (!account || account.password !== password) {
      throw new Error('手机号或密码错误')
    }

    const complete = resolveOnboardingComplete(account.employeeId)
    const next: MiniAppSession = {
      employeeId: account.employeeId,
      phone: normalizedPhone,
      onboardingComplete: complete,
      loggedInAt: new Date().toISOString(),
    }
    setSession(next)
    return next
  }

  function register(payload: { phone: string; password: string; name: string }) {
    const accounts = loadAccounts()
    if (accounts.some((a) => a.phone === payload.phone.trim())) {
      throw new Error('该手机号已注册')
    }
    const { employeeId } = store.registerMiniAppWorker(payload)
    accounts.push({
      phone: payload.phone.trim(),
      password: payload.password,
      employeeId,
    })
    saveAccounts(accounts)
    const next: MiniAppSession = {
      employeeId,
      phone: payload.phone.trim(),
      onboardingComplete: false,
      loggedInAt: new Date().toISOString(),
    }
    setSession(next)
    return next
  }

  function completeOnboarding() {
    if (!session.value) return
    const next = { ...session.value, onboardingComplete: true }
    setSession(next)
  }

  function refreshOnboardingStatus() {
    if (!session.value) return
    const complete = resolveOnboardingComplete(session.value.employeeId)
    if (complete !== session.value.onboardingComplete) {
      setSession({ ...session.value, onboardingComplete: complete })
    }
  }

  function logout() {
    session.value = null
    writeSession(null)
  }

  return {
    session,
    employeeId,
    isAuthed,
    onboardingComplete,
    syncSession,
    login,
    register,
    completeOnboarding,
    refreshOnboardingStatus,
    logout,
  }
}
