<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { incomeStatusMap } from '@/constants/miniapp'

const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const activeTab = ref<'claimable' | 'pending' | 'claimed'>('claimable')
const selected = ref<string[]>([])

const records = computed(() => {
  const all = store.workerIncomeRecords.filter((r) => r.employeeId === employeeId.value)
  if (activeTab.value === 'claimable') return all.filter((r) => r.status === 'claimable')
  if (activeTab.value === 'pending') return all.filter((r) => r.status === 'pending_settlement')
  return all.filter((r) => r.status === 'claimed')
})

const claimableTotal = computed(() =>
  store.workerIncomeRecords
    .filter((r) => r.employeeId === employeeId.value && r.status === 'claimable')
    .reduce((s, r) => s + r.amount, 0),
)

function toggleSelect(id: string) {
  const idx = selected.value.indexOf(id)
  if (idx >= 0) selected.value.splice(idx, 1)
  else selected.value.push(id)
}

function claimSingle(id: string) {
  try {
    store.claimWorkerIncome([id], employeeId.value)
    ElMessage.success('领取成功')
    selected.value = selected.value.filter((x) => x !== id)
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '领取失败')
  }
}

function claimBatch() {
  if (selected.value.length === 0) {
    ElMessage.info('请选择要领取的收入')
    return
  }
  try {
    store.claimWorkerIncome(selected.value, employeeId.value)
    ElMessage.success(`已领取 ${selected.value.length} 笔收入`)
    selected.value = []
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '领取失败')
  }
}

function claimAll() {
  const ids = records.value.map((r) => r.id)
  if (ids.length === 0) return
  try {
    store.claimWorkerIncome(ids, employeeId.value)
    ElMessage.success('全部领取成功')
    selected.value = []
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '领取失败')
  }
}
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <button class="mini-nav-back" @click="router.back()">← 返回</button>
      <div class="mini-nav-title">我的收入</div>
    </div>
    <div class="mini-page">
      <div class="mini-tabs">
        <button class="mini-tab" :class="{ active: activeTab === 'claimable' }" @click="activeTab = 'claimable'">待领取</button>
        <button class="mini-tab" :class="{ active: activeTab === 'pending' }" @click="activeTab = 'pending'">待结算</button>
        <button class="mini-tab" :class="{ active: activeTab === 'claimed' }" @click="activeTab = 'claimed'">已领取</button>
      </div>

      <div v-if="activeTab === 'claimable' && claimableTotal > 0" class="mini-card" style="background: #fff5f5">
        <div style="font-size: 13px; color: #999">可领取总额</div>
        <div style="font-size: 28px; font-weight: 700; color: #e60012">¥{{ claimableTotal.toFixed(2) }}</div>
        <div style="display: flex; gap: 8px; margin-top: 12px">
          <button class="mini-btn-primary" style="flex: 1" @click="claimAll">一键领取</button>
          <button class="mini-btn-outline" style="flex: 1" @click="claimBatch">批量领取</button>
        </div>
      </div>

      <div v-for="r in records" :key="r.id" class="mini-card">
        <div style="display: flex; align-items: center; gap: 10px">
          <input
            v-if="activeTab === 'claimable'"
            type="checkbox"
            :checked="selected.includes(r.id)"
            @change="toggleSelect(r.id)"
          >
          <div style="flex: 1">
            <div style="font-size: 15px; font-weight: 500">{{ r.title }}</div>
            <div style="font-size: 12px; color: #999; margin-top: 4px">
              {{ incomeStatusMap[r.status] }}
              <span v-if="r.period"> · {{ r.period }}</span>
            </div>
            <div v-if="r.status === 'claimed'" style="font-size: 12px; color: #999; margin-top: 2px">
              个税 ¥{{ r.tax ?? 0 }} · 实发 ¥{{ r.netAmount ?? r.amount }}
            </div>
          </div>
          <div style="text-align: right">
            <div style="font-size: 18px; font-weight: 700; color: #e60012">¥{{ r.amount }}</div>
            <button
              v-if="activeTab === 'claimable'"
              class="mini-btn-outline"
              style="margin-top: 6px; padding: 4px 12px; font-size: 11px"
              @click="claimSingle(r.id)"
            >
              领取
            </button>
          </div>
        </div>
      </div>
      <div v-if="records.length === 0" class="mini-empty">暂无记录</div>
    </div>
  </div>
</template>
