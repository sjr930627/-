<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import {
  resolveBillStatusMeta,
  formatMoney,
  formatPeriod,
  billRemainingInvoiceAmount,
} from '@/constants/payrollBill'
import type { SettlementBillSummary } from '@/types'
import { formatBillingFormulaDisplay } from '@/constants/billingRule'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { isEnterprise, pathPrefix } = usePortal()

const paymentVisible = ref(false)
const voucherFile = ref('')

const bill = computed(() =>
  store.settlementBills.find((b) => b.id === route.params.id as string),
)

const billStatus = computed(() =>
  bill.value ? resolveBillStatusMeta(bill.value.status) : { label: '', type: 'info' as const },
)

const billingRule = computed(() =>
  bill.value?.billingRuleId
    ? store.billingRules.find((r) => r.id === bill.value!.billingRuleId)
    : null,
)

const summary = computed((): SettlementBillSummary => {
  if (bill.value?.summary) return bill.value.summary
  const lines = bill.value?.lines ?? []
  return {
    attendancePay: lines.reduce((s, l) => s + (l.attendancePay ?? 0), 0),
    taskPay: lines.reduce((s, l) => s + (l.taskPay ?? 0), 0),
    overtimePay: lines.reduce((s, l) => s + (l.overtimePay ?? 0), 0),
    deductions: lines.reduce((s, l) => s + (l.deductions ?? 0), 0),
    workerCount: lines.length,
  }
})

const feeRows = computed(() => {
  if (!bill.value) return []
  const rate = bill.value.serviceFeeRate
  const rateLabel = rate != null ? `${(rate * 100).toFixed(2)}%` : '—'
  return [
    { label: '考勤薪酬', amount: summary.value.attendancePay, note: '按考勤天数/工时计薪' },
    { label: '任务薪酬', amount: summary.value.taskPay, note: '按完成任务数计薪' },
    { label: '加班薪酬', amount: summary.value.overtimePay, note: '加班工时 × 加班单价' },
    { label: '扣款', amount: -summary.value.deductions, note: '考勤/违规等扣款', danger: true },
    { label: '结算金额', amount: bill.value.payrollTotal, note: `${summary.value.workerCount} 名灵工`, bold: true },
    { label: '服务费', amount: bill.value.serviceFee, note: `费率 ${rateLabel}`, bold: true },
    { label: '总计金额', amount: bill.value.totalPayable, note: '结算金额 + 服务费', highlight: true },
  ]
})

const timelineSteps = computed(() => {
  if (!bill.value) return []
  const b = bill.value
  return [
    { label: '创建账单', time: b.createdAt, done: true },
    { label: '提交至企业', time: b.pushedAt, done: !!b.pushedAt },
    { label: '企业确认', time: b.confirmedAt, done: !!b.confirmedAt },
    { label: '确认付款', time: b.paidAt ?? b.paymentSubmittedAt, done: !!b.paidAt },
  ]
})

function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}

function goBack() {
  router.push(`${pathPrefix.value}/payroll/bills`)
}

function confirmBill() {
  if (!bill.value) return
  try {
    store.confirmSettlementBill(bill.value.id)
    ElMessage.success('账单已确认，状态已更新为待付款')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

function openPayment() {
  voucherFile.value = ''
  paymentVisible.value = true
}

function submitPayment() {
  if (!bill.value) return
  try {
    store.submitBillPayment(bill.value.id, voucherFile.value || 'payment_voucher.pdf')
    paymentVisible.value = false
    ElMessage.success('付款已确认，账单状态为已付款')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败')
  }
}

function applyInvoice() {
  if (!bill.value) return
  router.push({
    path: `${pathPrefix.value}/payroll/invoices/apply`,
    query: { billId: bill.value.id },
  })
}

function submitBill() {
  if (!bill.value) return
  try {
    store.submitSettlementBill(bill.value.id)
    ElMessage.success('账单已提交，等待企业确认')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function voidBill() {
  if (!bill.value) return
  try {
    const { value } = await ElMessageBox.prompt('请输入作废原因（可选）', '作废账单', {
      confirmButtonText: '确认作废',
      cancelButtonText: '取消',
    })
    store.voidSettlementBill(bill.value.id, value)
    ElMessage.success('账单已作废')
  } catch {
    // cancelled
  }
}

function viewBillingRule() {
  if (bill.value?.billingRuleId) {
    router.push({
      path: `${pathPrefix.value}/payroll/billing-rules`,
      query: { highlight: bill.value.billingRuleId },
    })
  }
}
</script>

<template>
  <div v-if="bill" class="bill-detail">
    <div class="detail-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" link @click="goBack">返回账单列表</el-button>
        <h2 class="page-title">{{ bill.billNo }}</h2>
        <el-tag size="large" :type="billStatus.type">
          {{ billStatus.label }}
        </el-tag>
      </div>
      <div class="header-actions">
        <el-button
          v-if="!isEnterprise && bill.status === 'pending_submit'"
          type="primary"
          @click="submitBill"
        >
          提交至企业
        </el-button>
        <el-button
          v-if="!isEnterprise && ['pending_submit', 'pending_confirm', 'pending_payment'].includes(bill.status)"
          type="danger"
          plain
          @click="voidBill"
        >
          作废
        </el-button>
        <el-button
          v-if="isEnterprise && bill.status === 'pending_confirm'"
          type="primary"
          @click="confirmBill"
        >
          确认账单
        </el-button>
        <el-button
          v-if="isEnterprise && bill.status === 'pending_payment'"
          type="primary"
          @click="openPayment"
        >
          确认付款
        </el-button>
        <el-button
          v-if="isEnterprise && bill.status === 'paid' && billRemainingInvoiceAmount(bill) > 0"
          type="primary"
          @click="applyInvoice"
        >
          申请发票
        </el-button>
        <el-button
          v-if="isEnterprise && bill.status === 'paid'"
          @click="router.push(`${pathPrefix}/payroll/invoices`)"
        >
          查看发票
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="stat-row">
      <el-col :xs="12" :sm="6">
        <div class="stat-card">
          <span class="stat-label">结算金额</span>
          <span class="stat-value">{{ formatMoney(bill.payrollTotal) }}</span>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div class="stat-card">
          <span class="stat-label">服务费</span>
          <span class="stat-value">{{ formatMoney(bill.serviceFee) }}</span>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div class="stat-card highlight">
          <span class="stat-label">总计金额</span>
          <span class="stat-value">{{ formatMoney(bill.totalPayable) }}</span>
        </div>
      </el-col>
      <el-col :xs="12" :sm="6">
        <div class="stat-card">
          <span class="stat-label">灵工人数</span>
          <span class="stat-value">{{ summary.workerCount }} 人</span>
        </div>
      </el-col>
    </el-row>

    <div class="page-card section">
      <h3 class="section-title">基本信息</h3>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="企业">{{ bill.enterpriseName }}</el-descriptions-item>
        <el-descriptions-item label="服务商">{{ bill.serviceProviderName ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="结算周期">
          {{ formatPeriod(bill.periodStart, bill.periodEnd) }}
        </el-descriptions-item>
        <el-descriptions-item label="数据来源">
          {{
            bill.sourceType === 'excel'
              ? `Excel 导入${bill.excelFileName ? `（${bill.excelFileName}）` : ''}`
              : bill.sourceType === 'rule'
                ? '计费规则'
                : '—'
          }}
        </el-descriptions-item>
        <el-descriptions-item v-if="bill.importTemplateName" label="导入模板">
          {{ bill.importTemplateName }}
        </el-descriptions-item>
        <el-descriptions-item label="计费规则">
          <el-button
            v-if="bill.billingRuleName"
            link
            type="primary"
            @click="viewBillingRule"
          >
            {{ bill.billingRuleName }}
          </el-button>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="服务费率">
          {{ bill.serviceFeeRate != null ? `${(bill.serviceFeeRate * 100).toFixed(2)}%` : '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="已开票金额">
          {{ formatMoney(bill.invoicedAmount) }}
        </el-descriptions-item>
        <el-descriptions-item label="推送时间">{{ formatTime(bill.pushedAt ?? bill.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="确认时间">{{ formatTime(bill.confirmedAt) }}</el-descriptions-item>
        <el-descriptions-item label="到账时间">{{ formatTime(bill.paidAt) }}</el-descriptions-item>
        <el-descriptions-item v-if="bill.voidReason" label="作废原因" :span="3">
          {{ bill.voidReason }}
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <el-row :gutter="16">
      <el-col :xs="24" :lg="16">
        <div class="page-card section">
          <h3 class="section-title">费用汇总</h3>
          <el-table :data="feeRows" border stripe>
            <el-table-column prop="label" label="项目" width="140" />
            <el-table-column label="金额" width="160" align="right">
              <template #default="{ row }">
                <span
                  :class="{
                    'text-danger': row.danger,
                    'text-bold': row.bold,
                    'text-highlight': row.highlight,
                  }"
                >
                  {{ row.amount < 0 ? '-' : '' }}{{ formatMoney(Math.abs(row.amount)) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="note" label="说明" min-width="200" />
          </el-table>

          <template v-if="billingRule">
            <h4 class="sub-title">时薪计薪公式</h4>
            <div class="formula-box">
              <div class="formula-row">
                <span class="formula-label">灵工薪酬</span>
                <code>{{ formatBillingFormulaDisplay(billingRule.payrollFormula, store.billImportTemplates) }}</code>
              </div>
            </div>
          </template>
        </div>
      </el-col>

      <el-col :xs="24" :lg="8">
        <div class="page-card section">
          <h3 class="section-title">处理进度</h3>
          <el-timeline>
            <el-timeline-item
              v-for="step in timelineSteps"
              :key="step.label"
              :type="step.done ? 'success' : 'info'"
              :hollow="!step.done"
            >
              <p class="timeline-label">{{ step.label }}</p>
              <p class="timeline-time">{{ formatTime(step.time) }}</p>
            </el-timeline-item>
          </el-timeline>

          <template v-if="bill.paymentVoucher">
            <h4 class="sub-title">付款凭证</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="凭证文件">{{ bill.paymentVoucher }}</el-descriptions-item>
              <el-descriptions-item label="提交时间">
                {{ formatTime(bill.paymentSubmittedAt) }}
              </el-descriptions-item>
            </el-descriptions>
          </template>

          <h4 class="sub-title">收款账户</h4>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="开户银行">
              {{ store.platformPaymentAccount.bankName }}
            </el-descriptions-item>
            <el-descriptions-item label="账户名称">
              {{ store.platformPaymentAccount.accountName }}
            </el-descriptions-item>
            <el-descriptions-item label="银行账号">
              {{ store.platformPaymentAccount.accountNo }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>
    </el-row>

    <div class="page-card section">
      <h3 class="section-title">灵工明细</h3>
      <el-table v-if="bill.lines.length" :data="bill.lines" border stripe>
        <el-table-column prop="employeeNo" label="工号" width="110">
          <template #default="{ row }">{{ row.employeeNo ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="employeeName" label="姓名" width="90" fixed />
        <el-table-column prop="departmentName" label="部门" min-width="120" />
        <el-table-column prop="attendanceDays" label="考勤天数" width="90" align="center" />
        <el-table-column label="出勤工时" width="90" align="center">
          <template #default="{ row }">{{ row.workHours ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="taskCount" label="完成任务" width="90" align="center" />
        <el-table-column label="计件数" width="80" align="center">
          <template #default="{ row }">{{ row.pieceCount ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="考勤薪酬" width="110" align="right">
          <template #default="{ row }">
            {{ row.attendancePay != null ? formatMoney(row.attendancePay) : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="任务薪酬" width="110" align="right">
          <template #default="{ row }">
            {{ row.taskPay != null ? formatMoney(row.taskPay) : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="加班薪酬" width="110" align="right">
          <template #default="{ row }">
            {{ row.overtimePay != null ? formatMoney(row.overtimePay) : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="扣款" width="90" align="right">
          <template #default="{ row }">
            <span v-if="row.deductions" class="text-danger">-{{ formatMoney(row.deductions) }}</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="灵工薪酬" width="120" align="right" fixed="right">
          <template #default="{ row }">
            <strong>{{ formatMoney(row.payrollAmount) }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="服务费" width="100" align="right" fixed="right">
          <template #default="{ row }">{{ formatMoney(row.serviceFee) }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无灵工明细" />
    </div>
  </div>

  <div v-else class="page-card">
    <el-empty description="账单不存在或已被删除">
      <el-button type="primary" @click="goBack">返回账单列表</el-button>
    </el-empty>
  </div>

  <el-dialog v-model="paymentVisible" title="确认付款" width="520px" destroy-on-close>
    <template v-if="bill">
      <el-alert
        type="info"
        :closable="false"
        :title="`请向平台账户支付 ${formatMoney(bill.totalPayable)}`"
        style="margin-bottom: 16px"
      />
      <el-descriptions :column="1" border>
        <el-descriptions-item label="开户银行">
          {{ store.platformPaymentAccount.bankName }}
        </el-descriptions-item>
        <el-descriptions-item label="账户名称">
          {{ store.platformPaymentAccount.accountName }}
        </el-descriptions-item>
        <el-descriptions-item label="银行账号">
          {{ store.platformPaymentAccount.accountNo }}
        </el-descriptions-item>
        <el-descriptions-item label="开户支行">
          {{ store.platformPaymentAccount.branch }}
        </el-descriptions-item>
      </el-descriptions>
      <el-form label-width="100px" style="margin-top: 16px">
        <el-form-item label="付款凭证" required>
          <el-input v-model="voucherFile" placeholder="输入文件名或点击模拟上传">
            <template #append>
              <el-button @click="voucherFile = `payment_${Date.now()}.pdf`">模拟上传</el-button>
            </template>
          </el-input>
          <p class="text-muted" style="margin-top: 6px; font-size: 12px">支持银行回单截图/PDF</p>
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <el-button @click="paymentVisible = false">取消</el-button>
      <el-button type="primary" @click="submitPayment">提交付款凭证</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.bill-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.header-left .page-title {
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-row {
  margin: 0;
}

.stat-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-card.highlight {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.section {
  margin: 0;
}

.section-title {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
}

.sub-title {
  margin: 20px 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.formula-box {
  background: var(--el-fill-color-light);
  border-radius: 6px;
  padding: 12px 16px;
}

.formula-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 6px 0;
}

.formula-row + .formula-row {
  border-top: 1px dashed var(--el-border-color);
}

.formula-label {
  flex-shrink: 0;
  width: 72px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.formula-row code {
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 13px;
  color: var(--el-color-primary);
  word-break: break-all;
}

.timeline-label {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.timeline-time {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.text-danger {
  color: var(--el-color-danger);
}

.text-bold {
  font-weight: 600;
}

.text-highlight {
  font-weight: 700;
  color: var(--el-color-primary);
  font-size: 15px;
}
</style>
