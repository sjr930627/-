<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Check, Search } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import { billRemainingInvoiceAmount, formatMoney, formatPeriod } from '@/constants/payrollBill'
import { getEnterpriseInvoiceCategories } from '@/constants/enterprise'
import {
  allocateAmountToBills,
  billFeePreviewRows,
  defaultInvoiceProfile,
  invoiceTypeMap,
  maxInvoiceAmountForBills,
  mergeBillFeePreviewRows,
  normalizeInvoiceType,
  resolveInvoiceStatusMeta,
} from '@/constants/invoice'
import type { InvoiceType } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { pathPrefix, isEnterprise, isPlatform } = usePortal()

const saving = ref(false)
const submitting = ref(false)
const amountTouched = ref(false)
const uploadVisible = ref(false)
const uploadFileName = ref('')

const isReadonly = computed(() => typeof route.params.id === 'string' && !!route.params.id)

const application = computed(() => {
  if (!isReadonly.value) return null
  return store.invoiceApplications.find((item) => item.id === route.params.id) ?? null
})

const statusMeta = computed(() =>
  application.value ? resolveInvoiceStatusMeta(application.value.status) : null,
)

const form = ref({
  id: '' as string | undefined,
  billIds: [] as string[],
  invoiceType: 'electronic_special' as InvoiceType,
  invoiceCategory: '',
  amount: 0,
  invoiceContent: '',
  remark: '',
  recipientName: '',
  email: '',
})

const enterpriseId = computed(() => {
  if (isReadonly.value && application.value) return application.value.enterpriseId
  return isEnterprise.value ? store.currentEnterprise?.id : undefined
})

const invoiceProfile = computed(() =>
  defaultInvoiceProfile(store.enterpriseInvoiceProfiles, enterpriseId.value),
)

const invoiceCategories = computed(() =>
  getEnterpriseInvoiceCategories(store.enterprises, enterpriseId.value),
)

const displayProfile = computed(() => {
  if (isReadonly.value && application.value) {
    const profile = store.enterpriseInvoiceProfiles.find(
      (item) => item.enterpriseId === application.value!.enterpriseId,
    )
    return {
      title: application.value.title,
      taxNo: application.value.taxNo,
      address: profile?.address ?? '—',
      phone: profile?.phone ?? '—',
      bankName: profile?.bankName ?? '—',
      bankAccount: profile?.bankAccount ?? '—',
    }
  }
  return invoiceProfile.value
})

const invoiceableBills = computed(() =>
  store.settlementBills.filter((bill) => {
    if (bill.status !== 'paid') return false
    if (enterpriseId.value && bill.enterpriseId !== enterpriseId.value) return false
    return billRemainingInvoiceAmount(bill) > 0
  }),
)

const selectedBills = computed(() =>
  form.value.billIds
    .map((billId) => store.settlementBills.find((bill) => bill.id === billId))
    .filter((bill): bill is NonNullable<typeof bill> => !!bill),
)

const readonlyBillRows = computed(() => {
  if (!application.value) return []
  return application.value.bills.map((ref) => {
    const bill = store.settlementBills.find((item) => item.id === ref.billId)
    return {
      billNo: ref.billNo,
      period: bill ? formatPeriod(bill.periodStart, bill.periodEnd) : '—',
      amount: ref.amount,
    }
  })
})

const maxAmount = computed(() =>
  maxInvoiceAmountForBills(form.value.billIds, store.settlementBills),
)

const feePreviewRows = computed(() =>
  selectedBills.value.length > 1
    ? mergeBillFeePreviewRows(selectedBills.value)
    : billFeePreviewRows(selectedBills.value[0]),
)

const billOptions = computed(() =>
  invoiceableBills.value.map((bill) => ({
    value: bill.id,
    label: `${bill.billNo} · ${formatPeriod(bill.periodStart, bill.periodEnd)} · 可开 ${formatMoney(billRemainingInvoiceAmount(bill))}`,
  })),
)

watch(
  () => form.value.billIds,
  (billIds) => {
    if (isReadonly.value) return
    if (!amountTouched.value && billIds.length) {
      form.value.amount = maxInvoiceAmountForBills(billIds, store.settlementBills)
    }
    if (!isReadonly.value && billIds.length) {
      const firstBill = store.settlementBills.find((bill) => bill.id === billIds[0])
      if (firstBill) {
        const categories = getEnterpriseInvoiceCategories(store.enterprises, firstBill.enterpriseId)
        if (categories.length && !categories.includes(form.value.invoiceCategory)) {
          form.value.invoiceCategory = categories[0]
        }
      }
    }
  },
  { deep: true },
)

watch(invoiceCategories, (categories) => {
  if (isReadonly.value) return
  if (categories.length && !categories.includes(form.value.invoiceCategory)) {
    form.value.invoiceCategory = categories[0]
  }
})

onMounted(() => {
  if (isReadonly.value) {
    loadApplicationForView()
    return
  }

  const profile = invoiceProfile.value
  if (profile) {
    form.value.invoiceType = normalizeInvoiceType(profile.defaultInvoiceType)
  }

  const draftId = route.query.draftId
  const resubmitId = route.query.resubmitId
  if (typeof draftId === 'string') {
    loadExistingApplication(draftId, 'draft')
    return
  }
  if (typeof resubmitId === 'string') {
    loadExistingApplication(resubmitId, 'rejected')
    return
  }

  const billId = route.query.billId
  if (typeof billId === 'string') {
    form.value.billIds = [billId]
    const bill = store.settlementBills.find((item) => item.id === billId)
    if (bill) form.value.amount = billRemainingInvoiceAmount(bill)
  }
})

function loadApplicationForView() {
  const item = application.value
  if (!item) {
    ElMessage.error('发票申请不存在')
    goBack()
    return
  }
  if (isEnterprise.value && item.enterpriseId !== store.currentEnterprise?.id) {
    ElMessage.error('无权查看该发票申请')
    goBack()
    return
  }
  amountTouched.value = true
  form.value = {
    id: item.id,
    billIds: item.bills.map((bill) => bill.billId),
    invoiceType: normalizeInvoiceType(item.invoiceType),
    invoiceCategory: item.invoiceCategory ?? '',
    amount: item.amount,
    invoiceContent: item.invoiceContent,
    remark: item.remark ?? '',
    recipientName: item.recipientName ?? '',
    email: item.email ?? '',
  }
}

function loadExistingApplication(id: string, status: 'draft' | 'rejected') {
  const applicationItem = store.invoiceApplications.find(
    (item) => item.id === id && item.status === status,
  )
  if (!applicationItem) return
  amountTouched.value = true
  form.value = {
    id: applicationItem.id,
    billIds: applicationItem.bills.map((bill) => bill.billId),
    invoiceType: normalizeInvoiceType(applicationItem.invoiceType),
    invoiceCategory: applicationItem.invoiceCategory ?? '',
    amount: applicationItem.amount,
    invoiceContent: applicationItem.invoiceContent,
    remark: applicationItem.remark ?? '',
    recipientName: applicationItem.recipientName ?? '',
    email: applicationItem.email ?? '',
  }
}

function buildPayload() {
  const bills = selectedBills.value
  const profile = invoiceProfile.value
  if (!bills.length || !profile) throw new Error('请完善申请信息')
  if (!form.value.invoiceContent.trim()) throw new Error('请填写开票内容')
  if (!form.value.invoiceCategory) throw new Error('请选择开票类目')
  if (!form.value.recipientName.trim()) throw new Error('请填写收票人')
  if (!form.value.email.trim()) throw new Error('请填写邮箱')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email.trim())) {
    throw new Error('请填写正确的邮箱地址')
  }

  const billRefs = allocateAmountToBills(
    form.value.billIds,
    form.value.amount,
    store.settlementBills,
  )
  if (!billRefs.length) throw new Error('无法分摊开票金额，请检查所选账单')

  const firstBill = bills[0]
  return {
    id: form.value.id,
    bills: billRefs,
    enterpriseId: firstBill.enterpriseId,
    enterpriseName: firstBill.enterpriseName,
    invoiceType: form.value.invoiceType,
    invoiceContent: form.value.invoiceContent.trim(),
    invoiceCategory: form.value.invoiceCategory,
    title: profile.title,
    taxNo: profile.taxNo,
    amount: form.value.amount,
    remark: form.value.remark.trim() || undefined,
    recipientName: form.value.recipientName.trim(),
    email: form.value.email.trim(),
  }
}

function goBack() {
  router.push(`${pathPrefix.value}/payroll/invoices`)
}

async function saveDraft() {
  if (!form.value.billIds.length) {
    ElMessage.warning('请先选择关联账单')
    return
  }
  saving.value = true
  try {
    const item = store.saveInvoiceDraft(buildPayload())
    form.value.id = item.id
    ElMessage.success('草稿已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function submitApply() {
  if (!form.value.billIds.length) {
    ElMessage.warning('请先选择关联账单')
    return
  }
  submitting.value = true
  try {
    store.submitInvoiceApplication(buildPayload())
    ElMessage.success('发票申请已提交，等待后台审核')
    goBack()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败')
  } finally {
    submitting.value = false
  }
}

async function approveApplication() {
  if (!application.value) return
  try {
    store.approveInvoiceApplication(application.value.id)
    ElMessage.success('审核通过，已进入开票中')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function rejectApplication() {
  if (!application.value) return
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因', '驳回申请', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputPlaceholder: '驳回原因',
      inputValidator: (val) => !!val?.trim() || '请填写驳回原因',
    })
    store.rejectInvoiceApplication(application.value.id, value.trim())
    ElMessage.success('已驳回申请')
  } catch {
    // cancelled
  }
}

function openUpload() {
  if (!application.value) return
  uploadFileName.value = `${application.value.applicationNo}.pdf`
  uploadVisible.value = true
}

function confirmUpload() {
  if (!application.value || !uploadFileName.value.trim()) return
  try {
    store.completeInvoiceIssue(application.value.id, uploadFileName.value.trim())
    uploadVisible.value = false
    ElMessage.success('发票已上传，开票完成')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '上传失败')
  }
}

function resubmit() {
  if (!application.value) return
  router.push({
    path: `${pathPrefix.value}/payroll/invoices/apply`,
    query: { resubmitId: application.value.id },
  })
}

function downloadInvoice() {
  if (application.value?.electronicUrl) {
    ElMessage.success(`正在下载 ${application.value.applicationNo} 发票文件（演示）`)
  }
}
</script>

<template>
  <div class="invoice-apply-page">
    <div class="page-top">
      <div>
        <h2 class="page-title">
          {{ isReadonly ? '发票申请详情' : '发票申请' }}
        </h2>
        <p class="text-muted">
          {{
            isReadonly
              ? '查看发票申请完整信息，内容与申请页一致'
              : '选择一张或多张已完结账单，填写开票与收票信息后提交审核'
          }}
        </p>
      </div>
      <div class="page-top-right">
        <div v-if="isReadonly && application" class="page-top-meta">
          <span class="meta-label">发票单号</span>
          <strong>{{ application.applicationNo }}</strong>
          <el-tag v-if="statusMeta" size="small" :type="statusMeta.type">{{ statusMeta.label }}</el-tag>
        </div>
        <div class="page-top-actions">
          <template v-if="isReadonly">
            <el-button :icon="ArrowLeft" @click="goBack">返回列表</el-button>
            <template v-if="isPlatform && application">
              <el-button
                v-if="['pending_review', 'reviewing'].includes(application.status)"
                type="primary"
                @click="approveApplication"
              >
                审核通过
              </el-button>
              <el-button
                v-if="['pending_review', 'reviewing'].includes(application.status)"
                type="danger"
                @click="rejectApplication"
              >
                驳回
              </el-button>
              <el-button v-if="application.status === 'issuing'" type="primary" @click="openUpload">
                上传发票
              </el-button>
            </template>
            <el-button
              v-if="isEnterprise && application?.status === 'rejected'"
              type="primary"
              @click="resubmit"
            >
              重新提交
            </el-button>
            <el-button
              v-if="application?.status === 'issued' && application.electronicUrl"
              @click="downloadInvoice"
            >
              下载发票
            </el-button>
          </template>
          <template v-else>
            <el-button @click="goBack">取消</el-button>
            <el-button :loading="saving" @click="saveDraft">保存草稿</el-button>
            <el-button type="primary" :icon="Check" :loading="submitting" @click="submitApply">
              提交申请
            </el-button>
          </template>
        </div>
      </div>
    </div>

    <el-alert
      v-if="isReadonly && application?.rejectReason"
      type="error"
      :closable="false"
      show-icon
      :title="`驳回原因：${application.rejectReason}`"
      class="status-alert"
    />

    <div class="apply-layout">
      <div class="apply-main">
        <section class="form-card">
          <div class="card-title">关联账单</div>
          <el-form label-position="top">
            <el-form-item label="关联账单" required>
              <el-select
                v-model="form.billIds"
                multiple
                collapse-tags
                collapse-tags-tooltip
                filterable
                :disabled="isReadonly"
                placeholder="请选择需要开票的已完结账单，可多选"
                style="width: 100%"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
                <el-option
                  v-for="item in billOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <el-alert
            v-if="!isReadonly"
            :closable="false"
            type="info"
            show-icon
            title="可选择多张已完结账单合并开票，系统将自动汇总可开票金额"
          />
          <div v-if="isReadonly && readonlyBillRows.length" class="selected-bills">
            <div v-for="bill in readonlyBillRows" :key="bill.billNo" class="selected-bill-item">
              <span>{{ bill.billNo }}</span>
              <span class="text-muted">{{ bill.period }}</span>
              <strong>{{ formatMoney(bill.amount) }}</strong>
            </div>
          </div>
          <div v-else-if="selectedBills.length" class="selected-bills">
            <div v-for="bill in selectedBills" :key="bill.id" class="selected-bill-item">
              <span>{{ bill.billNo }}</span>
              <span class="text-muted">{{ formatPeriod(bill.periodStart, bill.periodEnd) }}</span>
              <strong>{{ formatMoney(billRemainingInvoiceAmount(bill)) }}</strong>
            </div>
          </div>
        </section>

        <section class="form-card">
          <div class="card-title">开票信息</div>
          <el-form label-position="top">
            <el-form-item v-if="isReadonly && application" label="企业">
              <el-input :model-value="application.enterpriseName" disabled />
            </el-form-item>
            <el-form-item label="发票类型" required>
              <el-radio-group v-model="form.invoiceType" :disabled="isReadonly">
                <el-radio value="electronic_special">{{ invoiceTypeMap.electronic_special }}</el-radio>
                <el-radio value="electronic_normal">{{ invoiceTypeMap.electronic_normal }}</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="开票金额" required>
              <el-input-number
                v-model="form.amount"
                :min="0.01"
                :max="maxAmount || undefined"
                :precision="2"
                :disabled="isReadonly || !form.billIds.length"
                controls-position="right"
                style="width: 100%"
                @change="amountTouched = true"
              />
              <p v-if="!isReadonly && form.billIds.length" class="field-tip">
                可开票金额上限：{{ formatMoney(maxAmount) }}
                <span v-if="form.billIds.length > 1">（{{ form.billIds.length }} 张账单合计）</span>
              </p>
            </el-form-item>
            <el-form-item label="开票类目" required>
              <el-input
                v-if="isReadonly"
                :model-value="form.invoiceCategory || application?.invoiceCategory || '—'"
                disabled
              />
              <template v-else>
                <el-select
                  v-model="form.invoiceCategory"
                  :disabled="!invoiceCategories.length"
                  placeholder="请选择开票类目"
                  style="width: 100%"
                >
                  <el-option
                    v-for="item in invoiceCategories"
                    :key="item"
                    :label="item"
                    :value="item"
                  />
                </el-select>
                <p v-if="!invoiceCategories.length" class="field-tip">
                  当前企业未维护可开发票类目，请联系平台管理员在企业管理中配置
                </p>
              </template>
            </el-form-item>
            <el-form-item label="开票内容" required>
              <el-input
                v-model="form.invoiceContent"
                :disabled="isReadonly"
                placeholder="如：技术服务费、咨询服务费等"
              />
            </el-form-item>
            <el-form-item label="备注说明">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="3"
                :disabled="isReadonly"
                placeholder="选填，可补充说明开票相关事项"
              />
            </el-form-item>
          </el-form>
        </section>

        <section class="form-card">
          <div class="card-title">收票人</div>
          <el-form label-position="top">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="收票人" required>
                  <el-input v-model="form.recipientName" :disabled="isReadonly" placeholder="请输入收票人姓名" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="邮箱" required>
                  <el-input v-model="form.email" :disabled="isReadonly" placeholder="请输入接收电子发票的邮箱" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </section>
      </div>

      <aside class="apply-side">
        <section class="side-card">
          <div class="side-card-header">
            <span>开票抬头</span>
          </div>
          <template v-if="displayProfile">
            <dl class="profile-list">
              <div><dt>企业名称</dt><dd>{{ displayProfile.title }}</dd></div>
              <div><dt>纳税人识别号</dt><dd>{{ displayProfile.taxNo }}</dd></div>
              <div><dt>注册地址</dt><dd>{{ displayProfile.address }}</dd></div>
              <div><dt>联系电话</dt><dd>{{ displayProfile.phone }}</dd></div>
              <div><dt>开户银行</dt><dd>{{ displayProfile.bankName }}</dd></div>
              <div><dt>银行账号</dt><dd>{{ displayProfile.bankAccount }}</dd></div>
            </dl>
          </template>
        </section>

        <section class="side-card">
          <div class="side-card-header"><span>费用明细预览</span></div>
          <div v-if="selectedBills.length" class="fee-preview">
            <div v-for="row in feePreviewRows" :key="row.label" class="fee-row" :class="{ highlight: row.highlight }">
              <span>{{ row.label }}</span>
              <strong>{{ formatMoney(Math.abs(row.amount)) }}</strong>
            </div>
          </div>
          <el-empty v-else description="请先选择关联账单" :image-size="64" />
        </section>

        <section v-if="isReadonly && application" class="side-card notice-card">
          <div class="side-card-header"><span>流程信息</span></div>
          <dl class="profile-list">
            <div><dt>申请时间</dt><dd>{{ new Date(application.createdAt).toLocaleString('zh-CN') }}</dd></div>
            <div v-if="application.submittedAt">
              <dt>提交时间</dt><dd>{{ new Date(application.submittedAt).toLocaleString('zh-CN') }}</dd>
            </div>
            <div v-if="application.reviewedAt">
              <dt>审核时间</dt><dd>{{ new Date(application.reviewedAt).toLocaleString('zh-CN') }}</dd>
            </div>
            <div v-if="application.issuedAt">
              <dt>开票时间</dt><dd>{{ new Date(application.issuedAt).toLocaleString('zh-CN') }}</dd>
            </div>
            <div v-if="application.invoiceFileName">
              <dt>发票文件</dt><dd>{{ application.invoiceFileName }}</dd>
            </div>
          </dl>
        </section>

        <section v-else class="side-card notice-card">
          <div class="side-card-header"><span>申请须知</span></div>
          <ol>
            <li>仅已完结（已付款）账单可申请开票，支持多账单合并。</li>
            <li>请确保开票金额不超过所选账单可开票上限合计。</li>
            <li>提交后将进入财务审核，审核通过后开具电子发票。</li>
            <li>电子发票将发送至您填写的邮箱，请注意查收。</li>
          </ol>
        </section>
      </aside>
    </div>
  </div>

  <el-dialog v-model="uploadVisible" title="上传发票" width="480px">
    <el-form label-width="90px">
      <el-form-item label="发票文件">
        <el-input v-model="uploadFileName" placeholder="如 INV-20250115-001.pdf" />
      </el-form-item>
      <p class="field-tip">演示环境填写文件名即可，上传后状态变为已开票</p>
    </el-form>
    <template #footer>
      <el-button @click="uploadVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmUpload">确认上传</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.invoice-apply-page {
  padding-bottom: 24px;
}

.page-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.page-top-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.page-top-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.page-top-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.meta-label {
  color: var(--el-text-color-secondary);
}

.status-alert {
  margin-bottom: 16px;
}

.apply-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
}

.form-card,
.side-card {
  background: #fff;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.card-title,
.side-card-header {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.side-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.selected-bills {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selected-bill-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  font-size: 13px;
}

.profile-list {
  margin: 0 0 12px;
}

.profile-list div {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
}

.profile-list dt {
  color: var(--el-text-color-secondary);
}

.profile-list dd {
  margin: 0;
}

.fee-preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fee-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.fee-row.highlight {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.notice-card ol {
  margin: 0;
  padding-left: 18px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.8;
}

.field-tip {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

@media (max-width: 1100px) {
  .apply-layout {
    grid-template-columns: 1fr;
  }
}
</style>
