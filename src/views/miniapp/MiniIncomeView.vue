<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import {
  calcWorkerIncomeTax,
  formatIncomeDate,
  formatIncomeDateTime,
  formatIncomeDetailRule,
  incomeStatusMap,
} from '@/constants/miniapp'
import type { WorkerIncomeDetailItem, WorkerIncomeRecord } from '@/types'

type IncomeTab = 'pending' | 'claimable' | 'claimed'
type PayChannel = 'alipay' | 'bank'

const router = useRouter()
const store = useAppStore()
const { employeeId, paymentBinding } = useMiniAppWorker()

const tabs: { key: IncomeTab; label: string }[] = [
  { key: 'pending', label: '待结算' },
  { key: 'claimable', label: '待领取' },
  { key: 'claimed', label: '已领取' },
]

const activeTab = ref<IncomeTab>('claimable')
const selected = ref<string[]>([])
const claimDialogVisible = ref(false)
const pendingClaimIds = ref<string[]>([])
const payChannel = ref<PayChannel>('alipay')
const expandedClaimKeys = ref<string[]>([])

const employeeRecords = computed(() =>
  store.workerIncomeRecords.filter((r) => r.employeeId === employeeId.value),
)

const records = computed(() => {
  if (activeTab.value === 'claimable') {
    return employeeRecords.value.filter((r) => r.status === 'claimable')
  }
  if (activeTab.value === 'pending') {
    return employeeRecords.value.filter((r) => r.status === 'pending_settlement')
  }
  return []
})

const pendingCount = computed(
  () =>
    employeeRecords.value.filter((r) => r.status === 'pending_settlement').length,
)

const claimableCount = computed(
  () => employeeRecords.value.filter((r) => r.status === 'claimable').length,
)

const pendingTotal = computed(() =>
  employeeRecords.value
    .filter((r) => r.status === 'pending_settlement')
    .reduce((s, r) => s + r.amount, 0),
)

const claimableTotal = computed(() =>
  employeeRecords.value
    .filter((r) => r.status === 'claimable')
    .reduce((s, r) => s + r.amount, 0),
)

const claimedBatches = computed(() => {
  const claimed = employeeRecords.value.filter((r) => r.status === 'claimed')
  const map = new Map<string, WorkerIncomeRecord[]>()
  for (const r of claimed) {
    const key = r.claimBatchId ?? r.claimedAt ?? r.id
    const list = map.get(key) ?? []
    list.push(r)
    map.set(key, list)
  }
  return [...map.entries()]
    .map(([key, batchRecords]) => ({
      key,
      claimedAt: batchRecords[0].claimedAt ?? batchRecords[0].createdAt,
      gross: batchRecords.reduce((s, r) => s + r.amount, 0),
      tax: batchRecords.reduce((s, r) => s + (r.tax ?? 0), 0),
      netAmount: batchRecords.reduce((s, r) => s + (r.netAmount ?? r.amount), 0),
      records: [...batchRecords].sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
})

const claimPreviewRecords = computed(() =>
  employeeRecords.value.filter(
    (r) =>
      pendingClaimIds.value.includes(r.id) && r.status === 'claimable',
  ),
)

const claimGross = computed(() =>
  claimPreviewRecords.value.reduce((s, r) => s + r.amount, 0),
)

const claimTaxPreview = computed(() => calcWorkerIncomeTax(claimGross.value))

const alipayLabel = computed(() => paymentBinding.value?.alipay ?? '未绑定')
const bankLabel = computed(() => {
  const b = paymentBinding.value
  if (!b?.bankName || !b?.bankCardLast4) return '未绑定'
  return `${b.bankName} 尾号${b.bankCardLast4}`
})

const canUseAlipay = computed(() => !!paymentBinding.value?.alipay)
const canUseBank = computed(() =>
  !!(paymentBinding.value?.bankName && paymentBinding.value?.bankCardLast4),
)

function recordDetailItems(r: WorkerIncomeRecord): WorkerIncomeDetailItem[] {
  if (r.items?.length) return r.items
  return [
    {
      id: `${r.id}_fallback`,
      title: r.title,
      unitPrice: r.amount,
      quantity: 1,
      calcType: r.source === 'attendance' ? 'hourly' : 'task',
      amount: r.amount,
    },
  ]
}

function toggleSelect(id: string) {
  const idx = selected.value.indexOf(id)
  if (idx >= 0) selected.value.splice(idx, 1)
  else selected.value.push(id)
}

function toggleClaimExpand(key: string) {
  const idx = expandedClaimKeys.value.indexOf(key)
  if (idx >= 0) expandedClaimKeys.value.splice(idx, 1)
  else expandedClaimKeys.value.push(key)
}

function openClaimDialog(ids: string[]) {
  if (ids.length === 0) {
    ElMessage.info('请选择要领取的收入')
    return
  }
  pendingClaimIds.value = ids
  payChannel.value = canUseAlipay.value ? 'alipay' : canUseBank.value ? 'bank' : 'alipay'
  claimDialogVisible.value = true
}

function claimSingle(id: string) {
  openClaimDialog([id])
}

function claimBatch() {
  openClaimDialog([...selected.value])
}

function claimAll() {
  const ids = employeeRecords.value
    .filter((r) => r.status === 'claimable')
    .map((r) => r.id)
  openClaimDialog(ids)
}

function closeClaimDialog() {
  claimDialogVisible.value = false
  pendingClaimIds.value = []
}

function confirmClaim() {
  if (payChannel.value === 'alipay' && !canUseAlipay.value) {
    ElMessage.warning('请先绑定支付宝')
    return
  }
  if (payChannel.value === 'bank' && !canUseBank.value) {
    ElMessage.warning('请先绑定银行卡')
    return
  }
  try {
    store.claimWorkerIncome(pendingClaimIds.value, employeeId.value, payChannel.value)
    ElMessage.success('领取成功')
    selected.value = selected.value.filter((id) => !pendingClaimIds.value.includes(id))
    closeClaimDialog()
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '领取失败')
  }
}

function goBindPayment() {
  closeClaimDialog()
  router.push('/miniapp/payment')
}
</script>

<template>
  <div class="income-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title">我的收入</div>
    </div>

    <div class="mini-page">
      <div class="income-tabs mini-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="mini-tab"
          :class="{ active: activeTab === tab.key }"
          type="button"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}<span v-if="tab.key === 'pending' && pendingCount" class="tab-badge">{{ pendingCount }}</span><span v-if="tab.key === 'claimable' && claimableCount" class="tab-badge">{{ claimableCount }}</span>
        </button>
      </div>

      <div v-if="activeTab === 'pending' && pendingTotal > 0" class="summary-card pending-summary">
        <div class="summary-label">待结算总额</div>
        <div class="summary-amount pending">¥{{ pendingTotal.toFixed(2) }}</div>
      </div>

      <div v-if="activeTab === 'claimable' && claimableTotal > 0" class="summary-card">
        <div class="summary-label">可领取总额</div>
        <div class="summary-amount">¥{{ claimableTotal.toFixed(2) }}</div>
        <div class="summary-actions">
          <button class="mini-btn-primary" type="button" @click="claimAll">一键领取</button>
          <button class="mini-btn-outline" type="button" @click="claimBatch">批量领取</button>
        </div>
      </div>

      <template v-if="activeTab === 'pending'">
        <div v-for="r in records" :key="r.id" class="mini-card income-item">
          <div class="income-item-header">
            <div>
              <div class="income-title">{{ r.title }}</div>
              <div v-if="r.period" class="income-meta">{{ r.period }} · {{ incomeStatusMap[r.status] }}</div>
            </div>
            <div class="income-amount">¥{{ r.amount.toFixed(2) }}</div>
          </div>
          <div class="detail-list">
            <div v-for="item in recordDetailItems(r)" :key="item.id" class="detail-row">
              <div class="detail-main">
                <div class="detail-title">{{ item.title }}</div>
                <div class="detail-meta">
                  <span v-if="item.date">{{ formatIncomeDate(item.date) }}</span>
                  <span class="detail-rule">{{ formatIncomeDetailRule(item) }}</span>
                </div>
              </div>
              <div class="detail-amount">¥{{ item.amount.toFixed(2) }}</div>
            </div>
          </div>
        </div>
        <div v-if="records.length === 0" class="mini-empty">暂无记录</div>
      </template>

      <template v-else-if="activeTab === 'claimable'">
        <div v-for="r in records" :key="r.id" class="mini-card income-item">
          <div class="income-item-row">
            <input
              type="checkbox"
              :checked="selected.includes(r.id)"
              @change="toggleSelect(r.id)"
            >
            <div class="income-item-main">
              <div class="income-title">{{ r.title }}</div>
              <div class="income-meta">
                {{ incomeStatusMap[r.status] }}
                <span v-if="r.period"> · {{ r.period }}</span>
              </div>
            </div>
            <div class="income-item-side">
              <div class="income-amount">¥{{ r.amount.toFixed(2) }}</div>
              <button
                class="mini-btn-outline claim-btn"
                type="button"
                @click="claimSingle(r.id)"
              >
                领取
              </button>
            </div>
          </div>
          <div class="detail-list">
            <div v-for="item in recordDetailItems(r)" :key="item.id" class="detail-row">
              <div class="detail-main">
                <div class="detail-title">{{ item.title }}</div>
                <div class="detail-meta">
                  <span v-if="item.date">{{ formatIncomeDate(item.date) }}</span>
                  <span class="detail-rule">{{ formatIncomeDetailRule(item) }}</span>
                </div>
              </div>
              <div class="detail-amount">¥{{ item.amount.toFixed(2) }}</div>
            </div>
          </div>
        </div>
        <div v-if="records.length === 0" class="mini-empty">暂无记录</div>
      </template>

      <template v-else>
        <div
          v-for="batch in claimedBatches"
          :key="batch.key"
          class="mini-card income-item claimed-batch"
        >
          <button type="button" class="claimed-header" @click="toggleClaimExpand(batch.key)">
            <div class="claimed-header-main">
              <div class="claimed-time">{{ formatIncomeDateTime(batch.claimedAt) }}</div>
              <div class="claimed-stats">
                <span class="claimed-net">领取 ¥{{ batch.netAmount.toFixed(2) }}</span>
                <span class="claimed-tax">个税 ¥{{ batch.tax.toFixed(2) }}</span>
              </div>
            </div>
            <el-icon class="expand-icon" :class="{ expanded: expandedClaimKeys.includes(batch.key) }">
              <ArrowDown />
            </el-icon>
          </button>
          <div v-if="expandedClaimKeys.includes(batch.key)" class="detail-list claimed-detail">
            <div v-for="r in batch.records" :key="r.id" class="claimed-record-group">
              <div class="claimed-record-head">
                <span class="claimed-record-title">{{ r.title }}</span>
                <span class="claimed-record-amount">¥{{ (r.netAmount ?? r.amount).toFixed(2) }}</span>
              </div>
              <div
                v-for="item in recordDetailItems(r)"
                :key="item.id"
                class="detail-row sub"
              >
                <div class="detail-main">
                  <div class="detail-title">{{ item.title }}</div>
                  <div class="detail-meta">
                    <span v-if="item.date">{{ formatIncomeDate(item.date) }}</span>
                    <span class="detail-rule">{{ formatIncomeDetailRule(item) }}</span>
                  </div>
                </div>
                <div class="detail-amount">¥{{ item.amount.toFixed(2) }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="claimedBatches.length === 0" class="mini-empty">暂无记录</div>
      </template>
    </div>

    <div v-if="claimDialogVisible" class="claim-mask" @click.self="closeClaimDialog">
      <div class="claim-dialog">
        <div class="claim-dialog-title">确认领取</div>
        <div class="claim-summary">
          <div class="claim-row">
            <span>领取笔数</span>
            <span>{{ claimPreviewRecords.length }} 笔</span>
          </div>
          <div class="claim-row">
            <span>税前金额</span>
            <span class="claim-gross">¥{{ claimGross.toFixed(2) }}</span>
          </div>
          <div class="claim-row highlight">
            <span>测算个税</span>
            <span class="claim-tax">¥{{ claimTaxPreview.tax.toFixed(2) }}</span>
          </div>
          <div class="claim-row">
            <span>预计实发</span>
            <span class="claim-net">¥{{ claimTaxPreview.netAmount.toFixed(2) }}</span>
          </div>
        </div>

        <div class="claim-channel-title">领取到</div>
        <div class="channel-options">
          <button
            type="button"
            class="channel-option"
            :class="{ active: payChannel === 'alipay', disabled: !canUseAlipay }"
            @click="canUseAlipay && (payChannel = 'alipay')"
          >
            <div class="channel-name">支付宝</div>
            <div class="channel-account">{{ alipayLabel }}</div>
          </button>
          <button
            type="button"
            class="channel-option"
            :class="{ active: payChannel === 'bank', disabled: !canUseBank }"
            @click="canUseBank && (payChannel = 'bank')"
          >
            <div class="channel-name">银行卡</div>
            <div class="channel-account">{{ bankLabel }}</div>
          </button>
        </div>

        <p v-if="!canUseAlipay && !canUseBank" class="bind-tip">
          尚未绑定收款账户，
          <button type="button" class="bind-link" @click="goBindPayment">去绑定</button>
        </p>

        <div class="claim-actions">
          <button type="button" class="mini-btn-outline" @click="closeClaimDialog">取消</button>
          <button
            type="button"
            class="mini-btn-primary"
            :disabled="!canUseAlipay && !canUseBank"
            @click="confirmClaim"
          >
            确认领取
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.income-page {
  min-height: 100%;
  background: var(--mini-bg);
}

.income-tabs .mini-tab {
  font-size: 12px;
  padding: 8px 4px;
}

.tab-badge {
  display: inline-block;
  min-width: 16px;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--mini-primary, #1677ff);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  vertical-align: top;
}

.summary-card {
  background: #fff5f5;
  border-radius: var(--mini-radius);
  padding: 14px;
  margin-bottom: 12px;
  box-shadow: var(--mini-shadow);
}

.pending-summary {
  background: #fffbeb;
}

.summary-label {
  font-size: 13px;
  color: #999;
}

.summary-amount {
  font-size: 28px;
  font-weight: 700;
  color: #ef4444;
  margin-top: 4px;
}

.summary-amount.pending {
  color: #d97706;
}

.summary-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.summary-actions .mini-btn-primary,
.summary-actions .mini-btn-outline {
  flex: 1;
}

.income-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.income-item-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.income-item-main {
  flex: 1;
  min-width: 0;
}

.income-title {
  font-size: 15px;
  font-weight: 500;
}

.income-meta {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.income-item-side {
  text-align: right;
}

.income-amount {
  font-size: 18px;
  font-weight: 700;
  color: #ef4444;
  flex-shrink: 0;
}

.claim-btn {
  margin-top: 6px;
  padding: 4px 12px;
  font-size: 11px;
}

.detail-list {
  border-top: 1px solid var(--mini-border, #f0f0f0);
  padding-top: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
}

.detail-row + .detail-row {
  border-top: 1px dashed var(--mini-border, #f0f0f0);
}

.detail-row.sub {
  padding: 6px 0 6px 8px;
}

.detail-main {
  flex: 1;
  min-width: 0;
}

.detail-title {
  font-size: 13px;
  color: var(--mini-text, #333);
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 3px;
  font-size: 11px;
  color: var(--mini-text-muted, #999);
}

.detail-rule {
  color: var(--mini-primary, #1677ff);
}

.detail-amount {
  font-size: 14px;
  font-weight: 600;
  color: var(--mini-text, #333);
  flex-shrink: 0;
}

.claimed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
}

.claimed-header-main {
  flex: 1;
  min-width: 0;
}

.claimed-time {
  font-size: 14px;
  font-weight: 600;
  color: var(--mini-text, #333);
}

.claimed-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
  font-size: 13px;
}

.claimed-net {
  color: #ef4444;
  font-weight: 600;
}

.claimed-tax {
  color: #ea580c;
}

.expand-icon {
  flex-shrink: 0;
  color: var(--mini-text-muted, #999);
  transition: transform 0.2s;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.claimed-detail {
  margin-top: 10px;
}

.claimed-record-group + .claimed-record-group {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--mini-border, #f0f0f0);
}

.claimed-record-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.claimed-record-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--mini-text-secondary, #666);
}

.claimed-record-amount {
  font-size: 13px;
  font-weight: 600;
  color: #ef4444;
}

.claim-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
  padding: 16px;
  box-sizing: border-box;
}

.claim-dialog {
  width: 100%;
  max-width: 430px;
  background: #fff;
  border-radius: 16px 16px 12px 12px;
  padding: 20px 16px calc(16px + env(safe-area-inset-bottom, 0px));
}

.claim-dialog-title {
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 16px;
}

.claim-summary {
  background: #f9fafb;
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
}

.claim-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
  color: var(--mini-text-secondary);
}

.claim-row.highlight {
  color: #ea580c;
  font-weight: 600;
}

.claim-gross {
  color: var(--mini-text);
  font-weight: 600;
}

.claim-tax {
  color: #ea580c;
  font-weight: 700;
}

.claim-net {
  color: #ef4444;
  font-weight: 700;
  font-size: 16px;
}

.claim-channel-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}

.channel-options {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.channel-option {
  flex: 1;
  padding: 12px;
  border: 2px solid var(--mini-border);
  border-radius: 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.channel-option.active {
  border-color: var(--mini-primary);
  background: #eff6ff;
}

.channel-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.channel-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--mini-text);
}

.channel-account {
  margin-top: 4px;
  font-size: 12px;
  color: var(--mini-text-muted);
}

.bind-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--mini-text-muted);
  text-align: center;
}

.bind-link {
  border: none;
  background: none;
  color: var(--mini-primary);
  cursor: pointer;
  padding: 0;
  font-size: 13px;
}

.claim-actions {
  display: flex;
  gap: 10px;
}

.claim-actions .mini-btn-outline,
.claim-actions .mini-btn-primary {
  flex: 1;
}
</style>
