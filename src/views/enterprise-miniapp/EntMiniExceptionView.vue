<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { formatCancelShiftReason } from '@/constants/cancelShift'
import {
  buildConfirmHoursWarning,
  buildDailyAttendanceList,
  getStatusLabel,
} from '@/services/attendance'

type TabKey = 'makeup' | 'cancel'
type FlowStep = 'correct' | 'confirm'

interface PostMakeupContext {
  makeupId: string
  employeeId: string
  employeeName: string
  date: string
  punchType: string
  time: string
  systemHours: number
  scheduledHours: number
  statusLabel: string
}

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { enterpriseId, displayName } = useEnterpriseMiniAuth()
const operatorName = computed(() => displayName.value || '企业小程序')

const tab = ref<TabKey>(route.query.tab === 'cancel' ? 'cancel' : 'makeup')

watch(
  () => route.query.tab,
  (v) => {
    tab.value = v === 'cancel' ? 'cancel' : 'makeup'
  },
)

function switchTab(next: TabKey) {
  tab.value = next
  router.replace({
    path: '/enterprise-miniapp/exceptions',
    query: { tab: next },
  })
}

const pageTitle = computed(() =>
  tab.value === 'cancel' ? '取消班次申请' : '补卡申请',
)

const flowOpen = ref(false)
const flowStep = ref<FlowStep>('correct')
const flowCtx = ref<PostMakeupContext | null>(null)
const correctHours = ref(0)
const correctNote = ref('')

const confirmDisplayHours = computed(() => {
  if (!flowCtx.value) return 0
  return resolveDayHours(flowCtx.value.employeeId, flowCtx.value.date).systemHours
})

const enterpriseEmployeeIds = computed(
  () =>
    new Set(
      store.employees
        .filter((e) => e.enterpriseId === enterpriseId.value)
        .map((e) => e.id),
    ),
)

const makeupPending = computed(() =>
  store.makeupRequests
    .filter((r) => r.status === 'pending' && enterpriseEmployeeIds.value.has(r.employeeId))
    .map((r) => ({
      ...r,
      employeeName: store.employees.find((e) => e.id === r.employeeId)?.name || r.employeeId,
    })),
)

const cancelPending = computed(() =>
  store.cancelShiftRequests
    .filter((r) => r.status === 'pending' && enterpriseEmployeeIds.value.has(r.employeeId))
    .map((r) => ({
      ...r,
      employeeName: store.employees.find((e) => e.id === r.employeeId)?.name || r.employeeId,
      shiftName: store.shifts.find((s) => s.id === r.shiftId)?.name ?? '—',
      initiatedByLabel: r.initiatedBy === 'employee' ? '灵工申请' : '管理端发起',
      reasonDisplay: formatCancelShiftReason(r),
      sourceLabel: r.source === 'grab' ? '抢班' : '排班',
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
)

const exceptions = computed(() =>
  store.exceptions
    .filter(
      (e) =>
        (e.status === 'open' || e.status === 'appealed') &&
        enterpriseEmployeeIds.value.has(e.employeeId),
    )
    .map((e) => ({
      ...e,
      employeeName: store.employees.find((x) => x.id === e.employeeId)?.name || e.employeeId,
    }))
    .slice(0, 40),
)

function resolveDayHours(employeeId: string, date: string) {
  const rows = buildDailyAttendanceList(
    [employeeId],
    [date],
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  )
  const day = rows[0]
  return {
    systemHours: day?.workHours ?? 0,
    scheduledHours: day?.scheduledHours ?? 0,
    statusLabel: day ? getStatusLabel(day.status) : '—',
  }
}

function openPostFlow(payload: {
  makeupId: string
  employeeId: string
  employeeName: string
  date: string
  punchType: string
  time: string
}) {
  const hours = resolveDayHours(payload.employeeId, payload.date)
  flowCtx.value = {
    ...payload,
    ...hours,
  }
  correctHours.value = hours.systemHours
  correctNote.value = ''
  flowStep.value = 'correct'
  flowOpen.value = true
}

function closeFlow(message?: string) {
  flowOpen.value = false
  flowCtx.value = null
  if (message) ElMessage.success(message)
}

async function reviewMakeup(id: string, approved: boolean) {
  const req = makeupPending.value.find((r) => r.id === id)
  if (!req) return

  let note = ''
  if (!approved) {
    const { value } = await ElMessageBox.prompt('请填写驳回原因', '驳回补卡申请', {
      inputPlaceholder: '如：证据不足 / 时间不符',
    })
    note = String(value || '').trim()
    if (!note) {
      ElMessage.warning('驳回须填写原因')
      return
    }
  } else {
    try {
      const { value } = await ElMessageBox.prompt('审批意见（可选）', '通过补卡申请', {
        inputValue: '同意',
        inputPlaceholder: '请输入',
      })
      note = String(value || '').trim() || '企业小程序通过'
    } catch {
      return
    }
  }
  try {
    store.reviewMakeupRequest(id, approved, note, operatorName.value)
    if (!approved) {
      ElMessage.success('补卡已驳回')
      return
    }
    ElMessage.success('补卡已通过')
    openPostFlow({
      makeupId: req.id,
      employeeId: req.employeeId,
      employeeName: req.employeeName,
      date: req.date,
      punchType: req.punchType,
      time: req.time,
    })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '处理失败')
  }
}

/** 与 PC 端考勤审批一致：通过/驳回取消班次，通过后移除排班 */
async function reviewCancel(id: string, approved: boolean) {
  const req = cancelPending.value.find((r) => r.id === id)
  if (!req) return

  try {
    const { value } = await ElMessageBox.prompt(
      approved ? '审批意见（可选）' : '驳回原因',
      approved ? '通过取消班次申请' : '驳回取消班次申请',
      {
        inputValue: approved ? '同意' : '',
        inputPlaceholder: approved ? '请输入' : '请填写驳回原因',
      },
    )
    const note = String(value || '').trim()
    if (!approved && !note) {
      ElMessage.warning('驳回须填写原因')
      return
    }
    store.reviewCancelShiftRequest(
      id,
      approved,
      note || (approved ? '企业小程序通过' : ''),
      operatorName.value,
    )
    ElMessage.success(
      approved
        ? `已通过，${req.employeeName} ${req.date} 排班已移除`
        : '取消班次申请已驳回',
    )
  } catch {
    /* cancelled */
  }
}

function submitCorrection() {
  const ctx = flowCtx.value
  if (!ctx) return
  if (correctHours.value < 0) {
    ElMessage.warning('工时不能为负数')
    return
  }
  const note = correctNote.value.trim()
  if (!note) {
    ElMessage.warning('校对工时须填写原因')
    return
  }
  try {
    store.setWorkHoursCorrection(
      ctx.employeeId,
      ctx.date,
      Number(correctHours.value),
      note,
      operatorName.value,
      { autoConfirm: false },
    )
    const refreshed = resolveDayHours(ctx.employeeId, ctx.date)
    flowCtx.value = {
      ...ctx,
      systemHours: Number(correctHours.value),
      scheduledHours: refreshed.scheduledHours,
      statusLabel: refreshed.statusLabel,
    }
    flowStep.value = 'confirm'
    ElMessage.success('工时已校对，请确认工时')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '校对失败')
  }
}

function skipCorrectionToConfirm() {
  flowStep.value = 'confirm'
}

function skipAllLater() {
  closeFlow('已跳过工时处理，可稍后在「工时确认」中单独处理')
}

async function confirmHours() {
  const ctx = flowCtx.value
  if (!ctx) return
  const hours = resolveDayHours(ctx.employeeId, ctx.date)
  const workHours = hours.systemHours
  const warning = buildConfirmHoursWarning([
    {
      name: ctx.employeeName,
      workHours,
      scheduledHours: hours.scheduledHours,
    },
  ])
  if (warning) {
    try {
      await ElMessageBox.confirm(warning, '工时异常提醒', {
        type: 'warning',
        confirmButtonText: '仍按现工时确认',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
  }
  try {
    store.confirmWorkHours(ctx.employeeId, ctx.date, {
      workHours,
      operator: operatorName.value,
      note: '补卡通过后确认工时',
    })
    closeFlow(`已确认 ${ctx.employeeName} ${ctx.date} 工时 ${workHours}h`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '确认失败')
  }
}

function skipConfirmLater() {
  const ctx = flowCtx.value
  closeFlow('已跳过确认工时，可稍后单独处理')
  if (ctx) {
    router.push({
      path: '/enterprise-miniapp/hours-confirm',
      query: { date: ctx.date, employee: ctx.employeeId },
    })
  }
}

async function resolveExc(id: string) {
  const { value } = await ElMessageBox.prompt('请填写处理说明', '考勤异常处理', {
    inputPlaceholder: '如：已联系本人确认，按正常出勤处理',
  })
  const note = String(value || '').trim()
  if (!note) {
    ElMessage.warning('须填写处理说明')
    return
  }
  try {
    store.resolveException(id, note, operatorName.value)
    ElMessage.success('异常已处理')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '处理失败')
  }
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar :title="pageTitle" back-to="/enterprise-miniapp/attendance" />

    <div class="tabs">
      <button
        type="button"
        :class="{ active: tab === 'makeup' }"
        @click="switchTab('makeup')"
      >
        补卡申请{{ makeupPending.length ? ` ${makeupPending.length}` : '' }}
      </button>
      <button
        type="button"
        :class="{ active: tab === 'cancel' }"
        @click="switchTab('cancel')"
      >
        取消班次{{ cancelPending.length ? ` ${cancelPending.length}` : '' }}
      </button>
    </div>

    <section v-if="tab === 'makeup'" class="panel">
      <div v-if="!makeupPending.length" class="mini-empty">暂无待审补卡</div>
      <article v-for="r in makeupPending" :key="r.id" class="card">
        <strong>{{ r.employeeName }}</strong>
        <p>{{ r.date }} {{ r.time }} · {{ r.punchType === 'clock_in' ? '上班' : '下班' }}补卡</p>
        <p class="reason">原因：{{ r.reason || '-' }}</p>
        <div class="btns">
          <button type="button" class="ghost" @click="reviewMakeup(r.id, false)">驳回</button>
          <button type="button" class="mini-btn-primary sm" @click="reviewMakeup(r.id, true)">
            通过
          </button>
        </div>
      </article>

      <h3 class="sub-title">出勤异常</h3>
      <div v-if="!exceptions.length" class="mini-empty">暂无待处理异常</div>
      <article v-for="e in exceptions" :key="e.id" class="card">
        <strong>{{ e.employeeName }}</strong>
        <p>{{ e.date }} · {{ e.type }}</p>
        <p class="reason">{{ e.message }}</p>
        <div class="btns">
          <button type="button" class="mini-btn-primary sm" @click="resolveExc(e.id)">处理</button>
        </div>
      </article>
    </section>

    <section v-else class="panel">
      <p class="hint">通过后将移除当日排班（与 PC 端考勤审批一致）；驳回须填写原因</p>
      <div v-if="!cancelPending.length" class="mini-empty">暂无待审取消班次</div>
      <article v-for="r in cancelPending" :key="r.id" class="card">
        <div class="card-top">
          <strong>{{ r.employeeName }}</strong>
          <span class="pill">{{ r.initiatedByLabel }}</span>
        </div>
        <p>{{ r.date }} · {{ r.shiftName }} · {{ r.sourceLabel }}</p>
        <p class="reason">原因：{{ r.reasonDisplay }}</p>
        <div class="btns">
          <button type="button" class="ghost" @click="reviewCancel(r.id, false)">驳回</button>
          <button type="button" class="mini-btn-primary sm" @click="reviewCancel(r.id, true)">
            通过
          </button>
        </div>
      </article>
    </section>

    <!-- 补卡通过后：工时校对 → 确认工时（均可跳过） -->
    <div v-if="flowOpen && flowCtx" class="sheet-mask" @click.self="skipAllLater">
      <div class="sheet">
        <div class="sheet-head">
          <h3>补卡后续处理</h3>
          <button type="button" class="close" @click="skipAllLater">×</button>
        </div>
        <p class="sheet-sub">
          {{ flowCtx.employeeName }} · {{ flowCtx.date }} ·
          {{ flowCtx.punchType === 'clock_in' ? '上班' : '下班' }}补卡 {{ flowCtx.time }}
        </p>

        <div class="steps">
          <span :class="{ active: flowStep === 'correct', done: flowStep === 'confirm' }">1 工时校对</span>
          <i>›</i>
          <span :class="{ active: flowStep === 'confirm' }">2 确认工时</span>
        </div>

        <template v-if="flowStep === 'correct'">
          <div class="info-box">
            <p>补卡已写入打卡记录，请二次确认工时是否需要校对。</p>
            <p>
              当前系统工时 <strong>{{ flowCtx.systemHours }}h</strong>
              · 排班 {{ flowCtx.scheduledHours }}h
              · {{ flowCtx.statusLabel }}
            </p>
          </div>
          <label>校对工时（小时）</label>
          <input v-model.number="correctHours" type="number" min="0" step="0.5">
          <label>校对原因</label>
          <textarea v-model="correctNote" rows="2" placeholder="如需校对请填写原因；无需校对可直接跳过" />
          <div class="sheet-actions">
            <button type="button" class="mini-btn-primary" @click="submitCorrection">
              提交校对并进入确认
            </button>
            <button type="button" class="outline" @click="skipCorrectionToConfirm">
              无需校对，进入确认工时
            </button>
            <button type="button" class="text-btn" @click="skipAllLater">
              跳过，稍后单独处理
            </button>
          </div>
        </template>

        <template v-else>
          <div class="info-box">
            <p>请确认当日工时；也可跳过，之后在工时确认中单独处理。</p>
            <p>
              待确认工时 <strong>{{ confirmDisplayHours }}h</strong>
              · 排班 {{ flowCtx.scheduledHours }}h
            </p>
          </div>
          <div class="sheet-actions">
            <button type="button" class="mini-btn-primary" @click="confirmHours">
              确认工时
            </button>
            <button type="button" class="outline" @click="skipConfirmLater">
              跳过确认工时，单独处理
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 10px 16px 0;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 3px;
}
.tabs button {
  border: none;
  background: transparent;
  height: 34px;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
}
.tabs button.active {
  background: #fff;
  color: #228BFF;
  font-weight: 600;
}
.panel {
  padding: 12px 16px 8px;
}
.sub-title {
  margin: 16px 0 8px;
  font-size: 14px;
}
.hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.45;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: var(--mini-shadow);
}
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.card p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.reason {
  color: #9ca3af !important;
}
.pill {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #D5E9FF;
  color: #228BFF;
}
.btns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.ghost {
  border: 1px solid #fecaca;
  background: #fff;
  color: #b91c1c;
  border-radius: 8px;
  height: 30px;
  padding: 0 10px;
}
.sm {
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
  border: none;
  border-radius: 8px;
  background: #228BFF;
  color: #fff;
}
.mini-empty {
  padding: 16px 0 20px;
  text-align: center;
  color: #9ca3af;
  font-size: 12px;
}
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 430px;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sheet-head h3 {
  margin: 0;
  font-size: 16px;
  color: #111827;
}
.close {
  border: none;
  background: none;
  font-size: 22px;
  color: #9ca3af;
  line-height: 1;
}
.sheet-sub {
  margin: 6px 0 12px;
  font-size: 12px;
  color: #6b7280;
}
.steps {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #9ca3af;
}
.steps span.active {
  color: #228BFF;
  font-weight: 700;
}
.steps span.done {
  color: #16a34a;
}
.steps i {
  font-style: normal;
  color: #d1d5db;
}
.info-box {
  background: #f5f3ff;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.info-box p {
  margin: 0;
  font-size: 13px;
  color: #4b5563;
  line-height: 1.5;
}
.info-box p + p {
  margin-top: 6px;
}
.info-box strong {
  color: #228BFF;
}
.sheet label {
  display: block;
  margin: 8px 0 4px;
  font-size: 12px;
  color: #6b7280;
}
.sheet input,
.sheet textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
}
.sheet-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}
.mini-btn-primary,
.outline,
.text-btn {
  height: 42px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
}
.mini-btn-primary {
  border: none;
  background: #228BFF;
  color: #fff;
}
.outline {
  border: 1px solid #c7c3f5;
  background: #fff;
  color: #228BFF;
}
.text-btn {
  border: none;
  background: none;
  color: #9ca3af;
  font-weight: 500;
}
</style>
