export const ENTERPRISE_MINI_DEMO_PASSWORD = '123456'

export const ENTERPRISE_MINI_SESSION_KEY = 'enterprise-miniapp:session'

export interface EnterpriseMiniSession {
  accountId: string
  username: string
  displayName: string
  enterpriseId: string
  loggedInAt: string
}
