<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import { formatMoney } from '@/constants/payrollBill'
import {
  defaultInvoiceProfile,
  formatInvoiceBillLabel,
  invoiceApplicationsForEnterprise,
  invoiceStats,
  invoiceTypeMap,
  normalizeInvoiceType,
  profilesForEnterprise,
  resolveInvoiceStatusMeta,
} from '@/constants/invoice'
import type { EnterpriseInvoiceProfile, InvoiceApplication, InvoiceStatus, InvoiceType } from '@/types'

const store = useAppStore()
const router = useRouter()
const { pathPrefix, isEnterprise, isPlatform } = usePortal()

const statusFilter = ref<'all' | InvoiceStatus>('all')
const keyword = ref('')
const uploadVisible = ref(false)
const uploadTargetId = ref<string | null>(null)
const uploadFileName = ref('')

const profileDialogVisible = ref(false)
const profileSaving = ref(false)
const editingProfileId = ref<string | null>(null)
const invoiceTypeOptions = (
  Object.entries(invoiceTypeMap) as [InvoiceType, string][]
).map(([value, label]) => ({ value, label }))
const profileForm = ref({
  title: '',
  taxNo: '',
  address: '',
  phone: '',
  bankName: '',
  bankAccount: '',
  defaultInvoiceType: 'electronic_special' as InvoiceType,
  isDefault: false,
  remark: '',
})

const enterpriseId = computed(() =>
  isEnterprise.value ? store.currentEnterprise?.id : undefined,
)

const scopedApplications = computed(() =>
  invoiceApplicationsForEnterprise(store.invoiceApplications, enterpriseId.value)
    .filter((item) => item.status !== 'draft'),
)

const stats = computed(() =>
  invoiceStats(store.invoiceApplications, store.settlementBills, enterpriseId.value),
)

const invoiceProfiles = computed(() =>
  profilesForEnterprise(store.enterpriseInvoiceProfiles, enterpriseId.value),
)

const defaultProfile = computed(() =>
  defaultInvoiceProfile(store.enterpriseInvoiceProfiles, enterpriseId.value),
)

const tableData = computed(() =>
  scopedApplications.value
    .filter((item) => {
      if (statusFilter.value !== 'all' && item.status !== statusFilter.value) return false
      if (keyword.value.trim()) {
        const kw = keyword.value.trim().toLowerCase()
        const haystack = [
          item.applicationNo,
          ...item.bills.map((bill) => bill.billNo),
          item.enterpriseName,
          item.invoiceContent,
          item.title,
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(kw)) return false
      }
      return true
    })
    .map((item) => ({
      ...item,
      typeLabel: invoiceTypeMap[normalizeInvoiceType(item.invoiceType)],
      amountLabel: formatMoney(item.amount),
      categoryLabel: item.invoiceCategory ?? '—',
      billLabel: formatInvoiceBillLabel(item.bills),
      statusMeta: resolveInvoiceStatusMeta(item.status),
      createdLabel: new Date(item.createdAt).toLocaleString('zh-CN'),
      issuedLabel: item.issuedAt ? new Date(item.issuedAt).toLocaleString('zh-CN') : '—',
    })),
)

function goApply() {
  router.push(`${pathPrefix.value}/payroll/invoices/apply`)
}

function openDetail(id: string) {
  router.push(`${pathPrefix.value}/payroll/invoices/${id}`)
}

function resubmit(row: InvoiceApplication) {
  router.push({
    path: `${pathPrefix.value}/payroll/invoices/apply`,
    query: { resubmitId: row.id },
  })
}

async function approve(row: InvoiceApplication) {
  try {
    store.approveInvoiceApplication(row.id)
    ElMessage.success('审核通过，已进入开票中')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function reject(row: InvoiceApplication) {
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因', '驳回申请', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputPlaceholder: '驳回原因',
      inputValidator: (val) => !!val?.trim() || '请填写驳回原因',
    })
    store.rejectInvoiceApplication(row.id, value.trim())
    ElMessage.success('已驳回申请')
  } catch {
    // cancelled
  }
}

function openUpload(row: InvoiceApplication) {
  uploadTargetId.value = row.id
  uploadFileName.value = `${row.applicationNo}.pdf`
  uploadVisible.value = true
}

function confirmUpload() {
  if (!uploadTargetId.value || !uploadFileName.value.trim()) return
  try {
    store.completeInvoiceIssue(uploadTargetId.value, uploadFileName.value.trim())
    uploadVisible.value = false
    ElMessage.success('发票已上传，开票完成')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '上传失败')
  }
}

function downloadInvoice(row: InvoiceApplication) {
  if (row.electronicUrl) {
    ElMessage.success(`正在下载 ${row.applicationNo} 发票文件（演示）`)
  }
}

function resetProfileForm() {
  editingProfileId.value = null
  profileForm.value = {
    title: store.currentEnterprise?.name ?? '',
    taxNo: store.currentEnterprise?.creditCode ?? '',
    address: '',
    phone: '',
    bankName: '',
    bankAccount: '',
    defaultInvoiceType: 'electronic_special',
    isDefault: invoiceProfiles.value.length === 0,
    remark: '',
  }
}

function openCreateProfile() {
  resetProfileForm()
  profileDialogVisible.value = true
}

function openEditProfile(profile: EnterpriseInvoiceProfile) {
  editingProfileId.value = profile.id
  profileForm.value = {
    title: profile.title,
    taxNo: profile.taxNo,
    address: profile.address,
    phone: profile.phone,
    bankName: profile.bankName,
    bankAccount: profile.bankAccount,
    defaultInvoiceType: normalizeInvoiceType(profile.defaultInvoiceType),
    isDefault: !!profile.isDefault,
    remark: profile.remark ?? '',
  }
  profileDialogVisible.value = true
}

async function saveProfile() {
  if (!enterpriseId.value) return
  profileSaving.value = true
  try {
    store.saveEnterpriseInvoiceProfile({
      id: editingProfileId.value ?? undefined,
      enterpriseId: enterpriseId.value,
      ...profileForm.value,
    })
    profileDialogVisible.value = false
    ElMessage.success(editingProfileId.value ? '抬头已更新' : '抬头已新增')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    profileSaving.value = false
  }
}

function setDefaultProfile(profile: EnterpriseInvoiceProfile) {
  try {
    store.setDefaultEnterpriseInvoiceProfile(profile.id)
    ElMessage.success('已设为默认抬头')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function removeProfile(profile: EnterpriseInvoiceProfile) {
  try {
    await ElMessageBox.confirm(`确认删除抬头「${profile.title}」？`, '删除抬头', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    store.deleteEnterpriseInvoiceProfile(profile.id)
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="page-card invoice-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">
          发票管理
          <el-tag v-if="isEnterprise" size="small" type="info" class="edition-tag">企业版</el-tag>
        </h2>
        <p class="text-muted">
          {{
            isEnterprise
              ? '对已付款结算单发起开票申请，跟踪审核与开具进度'
              : '审核企业发票申请，开具并上传发票完成流程'
          }}
        </p>
      </div>
      <el-button v-if="isEnterprise" type="primary" :icon="Plus" @click="goApply">
        申请开票
      </el-button>
    </div>

    <el-row v-if="isEnterprise" :gutter="16" class="stats-row">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">可申请开票总额</div>
          <div class="stat-value">{{ formatMoney(stats.invoiceableTotal) }}</div>
          <div class="stat-sub">已付款结算单剩余可开金额</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card success">
          <div class="stat-label">已开票金额</div>
          <div class="stat-value">{{ formatMoney(stats.issuedAmount) }}</div>
          <div class="stat-sub">已完成开具的发票合计</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card warning">
          <div class="stat-label">待开票金额</div>
          <div class="stat-value">{{ formatMoney(stats.pendingAmount) }}</div>
          <div class="stat-sub">审核中与开票中的申请</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card purple">
          <div class="stat-label">发票单总数</div>
          <div class="stat-value">{{ stats.totalApplications }}</div>
          <div class="stat-sub">张</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="middle-row">
      <el-col v-if="isEnterprise" :span="14">
        <div class="panel-card">
          <div class="panel-title">发票单进度</div>
          <div class="progress-bar">
            <div class="seg success" :style="{ width: `${stats.progress.approved * 8}px` }">
              已开票 {{ stats.progress.approved }}
            </div>
            <div class="seg warning" :style="{ width: `${stats.progress.reviewing * 8}px` }">
              审核中 {{ stats.progress.reviewing }}
            </div>
            <div class="seg danger" :style="{ width: `${Math.max(stats.progress.rejected, 1) * 8}px` }">
              已驳回 {{ stats.progress.rejected }}
            </div>
          </div>
          <div class="progress-summary">
            <span class="box success">已开具 {{ stats.progress.approved }}</span>
            <span class="box warning">开票中 {{ stats.progress.reviewing }}</span>
          </div>
        </div>
      </el-col>
      <el-col :span="isEnterprise ? 10 : 24">
        <div class="panel-card">
          <div class="panel-title-row">
            <div class="panel-title">开票抬头（付款主体）</div>
            <el-button
              v-if="isEnterprise"
              link
              type="primary"
              @click="openCreateProfile"
            >
              新增抬头
            </el-button>
          </div>
          <template v-if="isEnterprise">
            <el-table
              :data="invoiceProfiles"
              size="small"
              border
              empty-text="暂无开票抬头，请先新增"
            >
              <el-table-column prop="title" label="付款主体/抬头" min-width="140" show-overflow-tooltip />
              <el-table-column prop="taxNo" label="信用代码" min-width="140" show-overflow-tooltip />
              <el-table-column label="默认" width="70" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.isDefault" size="small" type="success">默认</el-tag>
                  <span v-else class="text-muted">—</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openEditProfile(row)">编辑</el-button>
                  <el-button
                    v-if="!row.isDefault"
                    link
                    type="primary"
                    @click="setDefaultProfile(row)"
                  >
                    默认
                  </el-button>
                  <el-button link type="danger" @click="removeProfile(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
          <template v-else-if="defaultProfile">
            <dl class="profile-inline">
              <div><dt>企业名称</dt><dd>{{ defaultProfile.title }}</dd></div>
              <div><dt>纳税人识别号</dt><dd>{{ defaultProfile.taxNo }}</dd></div>
              <div><dt>默认发票类型</dt><dd>{{ invoiceTypeMap[normalizeInvoiceType(defaultProfile.defaultInvoiceType)] }}</dd></div>
              <div><dt>开户银行</dt><dd>{{ defaultProfile.bankName }}</dd></div>
              <div><dt>银行账号</dt><dd>{{ defaultProfile.bankAccount }}</dd></div>
            </dl>
          </template>
        </div>
      </el-col>
    </el-row>

    <div class="page-toolbar">
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="pending_review">待审核</el-radio-button>
        <el-radio-button value="reviewing">审核中</el-radio-button>
        <el-radio-button value="issuing">开票中</el-radio-button>
        <el-radio-button value="issued">已开票</el-radio-button>
        <el-radio-button value="rejected">已驳回</el-radio-button>
      </el-radio-group>
      <el-input
        v-model="keyword"
        placeholder="搜索发票单号、结算单号、企业"
        clearable
        prefix-icon="Search"
        style="width: 260px"
      />
    </div>

    <el-table :data="tableData" border stripe empty-text="暂无发票申请">
      <el-table-column prop="applicationNo" label="发票单号" min-width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row.id)">{{ row.applicationNo }}</el-button>
        </template>
      </el-table-column>
      <el-table-column prop="createdLabel" label="申请时间" width="170" />
      <el-table-column prop="typeLabel" label="发票类型" width="140" />
      <el-table-column prop="categoryLabel" label="开票类目" min-width="160" />
      <el-table-column prop="billLabel" label="关联账单" min-width="180" />
      <el-table-column prop="amountLabel" label="开票金额" width="130" align="right" />
      <el-table-column v-if="isPlatform" prop="enterpriseName" label="企业" min-width="160" />
      <el-table-column prop="title" label="发票抬头" min-width="160" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.statusMeta.type">{{ row.statusMeta.label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="issuedLabel" label="开票时间" width="170" />
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row.id)">查看</el-button>
          <template v-if="isPlatform">
            <el-button
              v-if="['pending_review', 'reviewing'].includes(row.status)"
              link
              type="primary"
              @click="approve(row)"
            >
              审核通过
            </el-button>
            <el-button
              v-if="['pending_review', 'reviewing'].includes(row.status)"
              link
              type="danger"
              @click="reject(row)"
            >
              驳回
            </el-button>
            <el-button v-if="row.status === 'issuing'" link type="primary" @click="openUpload(row)">
              上传发票
            </el-button>
          </template>
          <el-button
            v-if="isEnterprise && row.status === 'rejected'"
            link
            type="primary"
            @click="resubmit(row)"
          >
            重新提交
          </el-button>
          <el-button
            v-if="row.status === 'issued' && row.electronicUrl"
            link
            @click="downloadInvoice(row)"
          >
            下载
          </el-button>
        </template>
      </el-table-column>
    </el-table>
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

  <el-dialog
    v-model="profileDialogVisible"
    :title="editingProfileId ? '编辑开票抬头' : '新增开票抬头'"
    width="560px"
    destroy-on-close
  >
    <el-form label-width="110px">
      <el-form-item label="发票抬头" required>
        <el-input v-model="profileForm.title" placeholder="付款主体 / 开票企业名称" maxlength="100" />
      </el-form-item>
      <el-form-item label="纳税人识别号" required>
        <el-input v-model="profileForm.taxNo" placeholder="统一社会信用代码" maxlength="32" />
      </el-form-item>
      <el-form-item label="开户银行">
        <el-input v-model="profileForm.bankName" placeholder="选填" maxlength="80" />
      </el-form-item>
      <el-form-item label="银行账号">
        <el-input v-model="profileForm.bankAccount" placeholder="选填" maxlength="40" />
      </el-form-item>
      <el-form-item label="注册地址">
        <el-input v-model="profileForm.address" placeholder="选填" maxlength="120" />
      </el-form-item>
      <el-form-item label="电话">
        <el-input v-model="profileForm.phone" placeholder="选填" maxlength="30" />
      </el-form-item>
      <el-form-item label="默认发票类型">
        <el-select v-model="profileForm.defaultInvoiceType" style="width: 100%">
          <el-option
            v-for="item in invoiceTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="profileForm.remark" placeholder="如：总部主体 / 分公司" maxlength="80" />
      </el-form-item>
      <el-form-item v-if="!editingProfileId" label="设为默认">
        <el-switch v-model="profileForm.isDefault" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="profileDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="profileSaving" @click="saveProfile">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.edition-tag {
  margin-left: 8px;
  vertical-align: middle;
}

.stats-row {
  margin-bottom: 16px;
}

.stat-card {
  background: linear-gradient(135deg, #f5f9ff, #fff);
  border: 1px solid #dbeafe;
  border-radius: 12px;
  padding: 16px;
  min-height: 108px;
}

.stat-card.success {
  background: linear-gradient(135deg, #f0fdf4, #fff);
  border-color: #bbf7d0;
}

.stat-card.warning {
  background: linear-gradient(135deg, #fffbeb, #fff);
  border-color: #fde68a;
}

.stat-card.purple {
  background: linear-gradient(135deg, #faf5ff, #fff);
  border-color: #e9d5ff;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 700;
}

.stat-sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.middle-row {
  margin-bottom: 16px;
}

.panel-card {
  background: #fff;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  padding: 16px;
  min-height: 180px;
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 14px;
}

.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-title-row .panel-title {
  margin-bottom: 0;
}

.progress-bar {
  display: flex;
  height: 28px;
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
  margin-bottom: 12px;
}

.progress-bar .seg {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
}

.progress-bar .success {
  background: #22c55e;
}

.progress-bar .warning {
  background: #f59e0b;
}

.progress-bar .danger {
  background: #ef4444;
}

.progress-summary {
  display: flex;
  gap: 12px;
}

.progress-summary .box {
  flex: 1;
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  font-weight: 600;
}

.progress-summary .box.success {
  background: #ecfdf5;
  color: #059669;
}

.progress-summary .box.warning {
  background: #fffbeb;
  color: #d97706;
}

.profile-inline div {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.profile-inline dt {
  color: var(--el-text-color-secondary);
}

.profile-inline dd {
  margin: 0;
}

.page-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.field-tip {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
