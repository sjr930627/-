<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppNow } from '@/composables/useMiniAppNow'
import {
  buildClaimedBatches,
  buildClaimDateMap,
  getCalendarCells,
  getClaimMonthStats,
} from '@/composables/useMiniIncomeCalendar'
import {
  calcWorkerIncomeTax,
  formatIncomeDate,
  formatIncomeDateTime,
  formatIncomeDetailRule,
  MINIAPP_DEMO_ANCHOR_DATE,
} from '@/constants/miniapp'
import type { WorkerIncomeDetailItem, WorkerIncomeRecord } from '@/types'

type IncomeTab = 'pending' | 'claimable' | 'claimed'
type PayChannel = 'alipay' | 'bank'

const router = useRouter()
const store = useAppStore()
const { employeeId, employee, paymentBinding } = useMiniAppWorker()
const { now } = useMiniAppNow()

type IncomeAggKind = 'hourly' | 'task'

interface IncomeAggCard {
  id: string
  title: string
  enterpriseName: string
  kind: IncomeAggKind
  kindLabel: string
  amount: number
  period?: string
  items: WorkerIncomeDetailItem[]
  recordIds: string[]
}

function incomeKindOf(r: WorkerIncomeRecord): IncomeAggKind {
  return r.source === 'attendance' ? 'hourly' : 'task'
}

function incomeKindLabel(kind: IncomeAggKind) {
  return kind === 'hourly' ? '工时' : '任务'
}

function resolveIncomeEnterpriseName(r: WorkerIncomeRecord) {
  if (r.enterpriseName?.trim()) return r.enterpriseName.trim()
  if (r.enterpriseId) {
    const ent = store.enterprises.find((e) => e.id === r.enterpriseId)
    if (ent?.name) return ent.name
  }
  const empEntId = employee.value?.enterpriseId
  if (empEntId) {
    const ent = store.enterprises.find((e) => e.id === empEntId)
    if (ent?.name) return ent.name
  }
  const dept = store.departments.find((d) => d.id === employee.value?.departmentId)
  if (dept?.enterpriseId) {
    const ent = store.enterprises.find((e) => e.id === dept.enterpriseId)
    if (ent?.name) return ent.name
  }
  return '企业'
}

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

function buildIncomeAggCards(list: WorkerIncomeRecord[]): IncomeAggCard[] {
  const map = new Map<string, IncomeAggCard>()
  for (const r of list) {
    const kind = incomeKindOf(r)
    const enterpriseName = resolveIncomeEnterpriseName(r)
    const key = `${r.enterpriseId || enterpriseName}__${kind}`
    const existing = map.get(key)
    const items = recordDetailItems(r)
    if (existing) {
      existing.amount += r.amount
      existing.items.push(...items)
      existing.recordIds.push(r.id)
      if (r.period && (!existing.period || r.period > existing.period)) {
        existing.period = r.period
      }
    } else {
      map.set(key, {
        id: key,
        title: `${enterpriseName}|${incomeKindLabel(kind)}`,
        enterpriseName,
        kind,
        kindLabel: incomeKindLabel(kind),
        amount: r.amount,
        period: r.period,
        items: [...items],
        recordIds: [r.id],
      })
    }
  }
  return [...map.values()].sort((a, b) => {
    const byName = a.enterpriseName.localeCompare(b.enterpriseName, 'zh-CN')
    if (byName !== 0) return byName
    return a.kind === b.kind ? 0 : a.kind === 'hourly' ? -1 : 1
  })
}

function localDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const today = computed(() => localDateStr(now.value))

const [anchorYear, anchorMonth] = MINIAPP_DEMO_ANCHOR_DATE.split('-').map(Number)
const claimViewYear = ref(anchorYear)
const claimViewMonth = ref(anchorMonth)
const claimSelectedDate = ref(MINIAPP_DEMO_ANCHOR_DATE)

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

const employeeRecords = computed(() =>
  store.workerIncomeRecords.filter((r) => r.employeeId === employeeId.value),
)

const pendingCards = computed(() =>
  buildIncomeAggCards(
    employeeRecords.value.filter((r) => r.status === 'pending_settlement'),
  ),
)

const claimableCards = computed(() =>
  buildIncomeAggCards(
    employeeRecords.value.filter((r) => r.status === 'claimable'),
  ),
)

const pendingCount = computed(() => pendingCards.value.length)

const claimableCount = computed(() => claimableCards.value.length)

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

const claimedBatches = computed(() => buildClaimedBatches(employeeRecords.value))

const claimDateMap = computed(() => buildClaimDateMap(claimedBatches.value))

const claimMonthLabel = computed(() => `${claimViewYear.value}年${claimViewMonth.value}月`)

const claimMonthStats = computed(() =>
  getClaimMonthStats(claimViewYear.value, claimViewMonth.value, claimDateMap.value),
)

const claimCalendarCells = computed(() =>
  getCalendarCells(claimViewYear.value, claimViewMonth.value),
)

const selectedClaimDay = computed(() => claimDateMap.value.get(claimSelectedDate.value))

const claimSelectedDayLabel = computed(() => {
  const [, month, day] = claimSelectedDate.value.split('-')
  const prefix = claimSelectedDate.value === today.value ? '今日 · ' : ''
  return `${prefix}${Number(month)}月${Number(day)}日`
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

function toggleSelect(cardId: string) {
  const idx = selected.value.indexOf(cardId)
  if (idx >= 0) selected.value.splice(idx, 1)
  else selected.value.push(cardId)
}

function expandCardRecordIds(cardIds: string[]) {
  const idSet = new Set(cardIds)
  return claimableCards.value
    .filter((c) => idSet.has(c.id))
    .flatMap((c) => c.recordIds)
}

function prevClaimMonth() {
  if (claimViewMonth.value === 1) {
    claimViewMonth.value = 12
    claimViewYear.value -= 1
  } else {
    claimViewMonth.value -= 1
  }
}

function nextClaimMonth() {
  if (claimViewMonth.value === 12) {
    claimViewMonth.value = 1
    claimViewYear.value += 1
  } else {
    claimViewMonth.value += 1
  }
}

function selectClaimDate(date: string) {
  claimSelectedDate.value = date
}

function claimCellClass(date: string) {
  return {
    selected: date === claimSelectedDate.value,
    today: date === today.value,
    hasClaim: claimDateMap.value.has(date),
  }
}

function syncClaimCalendar() {
  const batches = claimedBatches.value
  if (!batches.length) return
  const latest = batches[0]
  claimSelectedDate.value = latest.claimDate
  const [y, m] = latest.claimDate.split('-').map(Number)
  claimViewYear.value = y
  claimViewMonth.value = m
}

watch(activeTab, (tab) => {
  if (tab === 'claimed') syncClaimCalendar()
})

function openClaimDialog(ids: string[]) {
  if (ids.length === 0) {
    ElMessage.info('请选择要领取的收入')
    return
  }
  pendingClaimIds.value = ids
  payChannel.value = canUseAlipay.value ? 'alipay' : canUseBank.value ? 'bank' : 'alipay'
  claimDialogVisible.value = true
}

function claimSingleCard(card: IncomeAggCard) {
  openClaimDialog([...card.recordIds])
}

function claimBatch() {
  openClaimDialog(expandCardRecordIds(selected.value))
}

function claimAll() {
  openClaimDialog(claimableCards.value.flatMap((c) => c.recordIds))
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
    selected.value = selected.value.filter((id) =>
      claimableCards.value.some((c) => c.id === id),
    )
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
        <div v-for="card in pendingCards" :key="card.id" class="mini-card income-item">
          <div class="income-item-header">
            <div>
              <div class="income-title">{{ card.title }}</div>
              <div class="income-meta">
                <template v-if="card.period">{{ card.period }} · </template>待结算
              </div>
            </div>
            <div class="income-amount">¥{{ card.amount.toFixed(2) }}</div>
          </div>
          <div class="detail-list">
            <div v-for="item in card.items" :key="item.id" class="detail-row">
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
        <div v-if="pendingCards.length === 0" class="mini-empty">暂无记录</div>
      </template>

      <template v-else-if="activeTab === 'claimable'">
        <div v-for="card in claimableCards" :key="card.id" class="mini-card income-item">
          <div class="income-item-row">
            <input
              type="checkbox"
              :checked="selected.includes(card.id)"
              @change="toggleSelect(card.id)"
            >
            <div class="income-item-main">
              <div class="income-title">{{ card.title }}</div>
              <div class="income-meta">
                待领取
                <span v-if="card.period"> · {{ card.period }}</span>
              </div>
            </div>
            <div class="income-item-side">
              <div class="income-amount">¥{{ card.amount.toFixed(2) }}</div>
              <button
                class="mini-btn-outline claim-btn"
                type="button"
                @click="claimSingleCard(card)"
              >
                领取
              </button>
            </div>
          </div>
          <div class="detail-list">
            <div v-for="item in card.items" :key="item.id" class="detail-row">
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
        <div v-if="claimableCards.length === 0" class="mini-empty">暂无记录</div>
      </template>

      <template v-else>
        <div v-if="claimedBatches.length" class="mini-card claimed-calendar-card">
          <div class="cc-month-bar">
            <button type="button" class="cc-nav-arrow" @click="prevClaimMonth">‹</button>
            <div class="cc-month-label">{{ claimMonthLabel }}</div>
            <button type="button" class="cc-nav-arrow" @click="nextClaimMonth">›</button>
          </div>

          <div class="cc-stats-row">
            <div class="cc-stat green">
              <div class="cc-stat-val">{{ claimMonthStats.claimDays }}</div>
              <div class="cc-stat-label">领取天次</div>
            </div>
            <div class="cc-stat blue">
              <div class="cc-stat-val">{{ claimMonthStats.batchCount }}</div>
              <div class="cc-stat-label">领取笔数</div>
            </div>
            <div class="cc-stat primary">
              <div class="cc-stat-val">¥{{ claimMonthStats.net.toLocaleString() }}</div>
              <div class="cc-stat-label">实发合计</div>
            </div>
          </div>

          <div class="cc-calendar-wrap">
            <div class="cc-week-head">
              <span v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w">{{ w }}</span>
            </div>
            <div class="cc-calendar-grid">
              <div
                v-for="(cell, idx) in claimCalendarCells"
                :key="idx"
                class="cc-cal-cell"
                :class="cell.date ? claimCellClass(cell.date) : 'empty'"
                @click="cell.date && selectClaimDate(cell.date)"
              >
                <template v-if="cell.day">
                  <span class="cc-cal-day">{{ cell.day }}</span>
                  <span v-if="cell.date && claimDateMap.has(cell.date)" class="cc-cal-bar" />
                  <span
                    v-if="cell.date && claimDateMap.get(cell.date)"
                    class="cc-cal-net"
                  >
                    ¥{{ Math.round(claimDateMap.get(cell.date)!.totalNet) }}
                  </span>
                </template>
              </div>
            </div>
            <div class="cc-legend">
              <span><i class="dot claimed" />有领取记录</span>
            </div>
          </div>

          <div class="cc-day-panel">
            <div class="cc-day-head">
              <strong>{{ claimSelectedDayLabel }}</strong>
              <span v-if="selectedClaimDay" class="cc-day-net">
                实发 ¥{{ selectedClaimDay.totalNet.toFixed(2) }}
              </span>
            </div>

            <template v-if="selectedClaimDay">
              <div
                v-for="batch in selectedClaimDay.batches"
                :key="batch.key"
                class="claimed-batch-block"
              >
                <div class="claimed-batch-head">
                  <span class="claimed-time">{{ formatIncomeDateTime(batch.claimedAt) }}</span>
                  <span class="claimed-net">¥{{ batch.netAmount.toFixed(2) }}</span>
                </div>
                <div class="claimed-batch-meta">
                  税前 ¥{{ batch.gross.toFixed(2) }} · 个税 ¥{{ batch.tax.toFixed(2) }}
                </div>
                <div v-for="r in batch.records" :key="r.id" class="claimed-record-group">
                  <div class="claimed-record-head">
                    <span class="claimed-record-title">{{ r.title }}</span>
                    <span class="claimed-record-amount">
                      ¥{{ (r.netAmount ?? r.amount).toFixed(2) }}
                    </span>
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
            </template>
            <p v-else class="cc-day-empty">该日无领取记录，请选择日历中有标记的日期</p>
          </div>
        </div>
        <div v-else class="mini-empty">暂无记录</div>
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

        <div class="claim-actions mini-dialog-actions">
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
  background: var(--mini-primary);
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
  color: var(--mini-primary);
}

.detail-amount {
  font-size: 14px;
  font-weight: 600;
  color: var(--mini-text, #333);
  flex-shrink: 0;
}

.claimed-calendar-card {
  padding-bottom: 4px;
}

.cc-month-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 12px;
}

.cc-nav-arrow {
  border: none;
  background: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  padding: 0 8px;
  line-height: 1;
}

.cc-month-label {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
}

.cc-stats-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.cc-stat {
  flex: 1;
  border-radius: 10px;
  padding: 10px 6px;
  text-align: center;
}

.cc-stat.green {
  background: #f0fdf4;
}

.cc-stat.blue {
  background: #E6FFFA;
}

.cc-stat.primary {
  background: #E6FFFA;
}

.cc-stat-val {
  font-size: 15px;
  font-weight: 800;
  color: #1a1a1a;
}

.cc-stat.green .cc-stat-val {
  color: #22c55e;
}

.cc-stat.blue .cc-stat-val {
  color: var(--mini-primary);
}

.cc-stat.primary .cc-stat-val {
  color: var(--mini-primary);
}

.cc-stat-label {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.cc-calendar-wrap {
  border-top: 1px solid #f3f4f6;
  padding-top: 12px;
}

.cc-week-head {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.cc-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cc-cal-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  cursor: pointer;
  padding: 2px;
  border: 2px solid transparent;
  min-height: 44px;
}

.cc-cal-cell.empty {
  cursor: default;
}

.cc-cal-cell.selected {
  background: #E6FFFA;
  border-color: var(--mini-primary);
}

.cc-cal-cell.today:not(.selected) {
  background: #f9fafb;
}

.cc-cal-cell.hasClaim:not(.selected) {
  background: #f0fdf4;
}

.cc-cal-day {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  line-height: 1.2;
}

.cc-cal-bar {
  width: 16px;
  height: 3px;
  border-radius: 2px;
  margin-top: 2px;
  background: #22c55e;
}

.cc-cal-net {
  font-size: 9px;
  color: #22c55e;
  font-weight: 700;
  margin-top: 1px;
  line-height: 1.1;
}

.cc-legend {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 10px;
  font-size: 11px;
  color: #999;
}

.cc-legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}

.cc-legend .dot.claimed {
  background: #22c55e;
}

.cc-day-panel {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
}

.cc-day-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
  color: #333;
}

.cc-day-net {
  font-size: 13px;
  font-weight: 700;
  color: var(--mini-primary);
}

.cc-day-empty {
  margin: 10px 0 0;
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
}

.claimed-batch-block {
  margin-top: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 12px;
}

.claimed-batch-block + .claimed-batch-block {
  margin-top: 10px;
}

.claimed-batch-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.claimed-time {
  font-size: 14px;
  font-weight: 600;
  color: var(--mini-text, #333);
}

.claimed-net {
  font-size: 15px;
  font-weight: 700;
  color: var(--mini-primary);
}

.claimed-batch-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.claimed-record-group {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #e5e7eb;
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
  color: #333;
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
  background: #E6FFFA;
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
