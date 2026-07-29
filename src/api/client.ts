/**
 * API 客户端抽象层 — Phase 3 预留后端对接。
 * 当前实现直接读写 Pinia store，后续可替换为 fetch/axios 调用。
 */
import { useAppStore } from '@/stores/app'

export const api = {
  getStore() {
    return useAppStore()
  },

  async healthCheck(): Promise<{ ok: boolean; mode: 'local' | 'remote' }> {
    return { ok: true, mode: 'local' }
  },
}

export type ApiMode = 'local' | 'remote'
