import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  ENTERPRISE_MINI_DEMO_PASSWORD,
  ENTERPRISE_MINI_SESSION_KEY,
  type EnterpriseMiniSession,
} from '@/constants/enterpriseMiniAuth'

export function readEnterpriseMiniSession(): EnterpriseMiniSession | null {
  try {
    const raw = localStorage.getItem(ENTERPRISE_MINI_SESSION_KEY)
    return raw ? (JSON.parse(raw) as EnterpriseMiniSession) : null
  } catch {
    return null
  }
}

function writeSession(session: EnterpriseMiniSession | null) {
  if (!session) {
    localStorage.removeItem(ENTERPRISE_MINI_SESSION_KEY)
    return
  }
  localStorage.setItem(ENTERPRISE_MINI_SESSION_KEY, JSON.stringify(session))
}

export function isEnterpriseMiniAuthed(): boolean {
  const session = readEnterpriseMiniSession()
  return Boolean(session?.accountId && session.enterpriseId)
}

export function useEnterpriseMiniAuth() {
  const store = useAppStore()
  const session = ref<EnterpriseMiniSession | null>(readEnterpriseMiniSession())

  const isAuthed = computed(() => Boolean(session.value?.accountId))
  const enterpriseId = computed(() => session.value?.enterpriseId ?? store.currentEnterpriseId)
  const displayName = computed(() => session.value?.displayName ?? '')

  function syncSession() {
    session.value = readEnterpriseMiniSession()
  }

  function login(username: string, password: string) {
    const name = username.trim()
    if (!name || !password) throw new Error('请输入账号和密码')

    const account = store.systemAccounts.find(
      (a) =>
        a.username === name &&
        a.accountPortal === 'enterprise' &&
        a.status === 'enabled' &&
        Boolean(a.enterpriseId),
    )
    if (!account || password !== ENTERPRISE_MINI_DEMO_PASSWORD) {
      throw new Error('账号或密码错误')
    }
    if (!account.enterpriseId) throw new Error('账号未绑定企业')

    const next: EnterpriseMiniSession = {
      accountId: account.id,
      username: account.username,
      displayName: account.displayName,
      enterpriseId: account.enterpriseId,
      loggedInAt: new Date().toISOString(),
    }
    session.value = next
    writeSession(next)
    store.setCurrentEnterprise(account.enterpriseId)
    return next
  }

  function logout() {
    session.value = null
    writeSession(null)
  }

  return {
    session,
    isAuthed,
    enterpriseId,
    displayName,
    syncSession,
    login,
    logout,
  }
}
