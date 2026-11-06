<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import { SCHEDULE_DEMO_NOW, SCHEDULE_DEMO_TODAY } from '@/constants/schedule'
import { generateId, getDepartmentDescendantIds, getDepartmentName, getDepartmentPath } from '@/utils'
import { resolveEnterpriseIdByDepartment, resolveEnterpriseIdByEmployee } from '@/utils/enterpriseScope'
import type { InsuranceClaimCommunication, InsuranceClaimProgress, InsuranceClaimRecord, InsuranceClaimStatus, InsurancePolicy, InsuranceProduct, InsuranceProductType } from '@/types'
import {
  canEditInsuranceClaim,
  normalizeInsuranceClaimCommunications,
  formatInsuranceCoverageScope,
  formatInsuranceDateTime,
  formatInsurancePeriod,
  getInsuranceClaimStatusLabel,
  getInsuranceClaimStatusTagType,
  getInsuranceEnrollmentDisplayLabel,
  getInsuranceEnrollmentDisplayStatus,
  getInsuranceEnrollmentDisplayTagType,
  getInsuranceProductTypeLabel,
  insuranceClaimProgressOptions,
  insuranceClaimStatusOptions,
  insuranceEnrolledAt,
  insurancePlanId,
  insuranceProductTypeOptions,
} from '@/services/insurance'
import { buildInsurancePolicyPdfBlob } from '@/services/insurancePolicyFile'

const route = useRoute()
const store = useAppStore()
const isPlatform = computed(() => !route.path.startsWith('/enterprise'))
const { enterpriseFilter, activeEnterpriseId, matchesEnterprise, enterpriseName, showEnterpriseControl } =
  useEnterpriseScope('filter')

const activeTab = ref<'products' | 'policies' | 'claims'>('policies')
const workDate = ref(SCHEDULE_DEMO_TODAY)
const departmentFilter = ref('')
const nameKeyword = ref('')
const phoneKeyword = ref('')
const productKeyword = ref('')
const policyNoKeyword = ref('')
const claimKeyword = ref('')
const claimStatusFilter = ref<InsuranceClaimStatus | ''>('')
const detailVisible = ref(false)
const policyFileVisible = ref(false)
const policyFileUrl = ref('')
const policyFileTitle = ref('保单文件')
const policyFileName = ref('policy.pdf')
const selectedPolicy = ref<InsurancePolicy | null>(null)
const claimDetailVisible = ref(false)
const selectedClaimId = ref('')
const progressStatus = ref<InsuranceClaimProgress>('reported')
const rejectVisible = ref(false)
const rejectReason = ref('')
const rejectReasonError = ref('')
const progressRemark = ref('')
const communicationDrafts = ref<InsuranceClaimCommunication[]>([])
const communicationEditingId = ref('')
const communicationDraftText = ref('')
const productDialogVisible = ref(false)
const productViewVisible = ref(false)
const viewingProduct = ref<InsuranceProduct | null>(null)
const productSaving = ref(false)
const editingProductId = ref('')

const productForm = reactive({
  name: '',
  planId: '',
  type: 'team_accident' as InsuranceProductType,
  provider: '',
  deathDisabilityAmount: null as number | null,
  medicalExpenseAmount: null as number | null,
  lostWageDailyAmount: null as number | null,
  suddenDeathAmount: null as number | null,
  description: '',
  enterpriseIds: [] as string[],
})

const productMap = computed(() =>
  Object.fromEntries(store.insuranceProducts.map((product) => [product.id, product])),
)

const visibleProducts = computed(() => {
  if (isPlatform.value) return store.insuranceProducts
  const enterpriseId = activeEnterpriseId.value
  return store.insuranceProducts.filter((product) => (product.enterpriseIds ?? []).includes(enterpriseId))
})

const employeeMap = computed(() =>
  Object.fromEntries(store.employees.map((employee) => [employee.id, employee])),
)

const demoNowLabel = formatInsuranceDateTime(SCHEDULE_DEMO_NOW)

const departmentOptions = computed(() =>
  store.departments
    .filter((department) =>
      matchesEnterprise(resolveEnterpriseIdByDepartment(department.id, store.departments)),
    )
    .map((department) => ({
      id: department.id,
      label: getDepartmentPath(store.departments, department.id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh')),
)

watch(enterpriseFilter, () => {
  if (!departmentFilter.value) return
  if (!departmentOptions.value.some((item) => item.id === departmentFilter.value)) {
    departmentFilter.value = ''
  }
})

function includesText(value: string | undefined, keyword: string) {
  const text = keyword.trim().toLowerCase()
  if (!text) return true
  return String(value ?? '').toLowerCase().includes(text)
}

const policyRows = computed(() =>
  store.insurancePolicies
    .filter((policy) => {
      if (policy.workDate !== workDate.value) return false
      const employee = employeeMap.value[policy.employeeId]
      if (!matchesEnterprise(resolveEnterpriseIdByEmployee(employee))) return false
      if (departmentFilter.value) {
        const departmentIds = getDepartmentDescendantIds(store.departments, departmentFilter.value)
        if (!employee?.departmentId || !departmentIds.has(employee.departmentId)) return false
      }
      const product = productMap.value[policy.productId]
      return (
        includesText(employee?.name, nameKeyword.value) &&
        includesText(employee?.phone, phoneKeyword.value) &&
        includesText(product?.name, productKeyword.value) &&
        includesText(policy.policyNo, policyNoKeyword.value)
      )
    })
    .sort((a, b) => insuranceEnrolledAt(b).localeCompare(insuranceEnrolledAt(a)))
    .map((policy) => {
      const employee = employeeMap.value[policy.employeeId]
      const product = productMap.value[policy.productId]
      const enterpriseId = resolveEnterpriseIdByEmployee(employee)
      return {
        ...policy,
        enterpriseName: enterpriseName(enterpriseId),
        departmentName: employee
          ? getDepartmentName(store.departments, employee.departmentId)
          : '—',
        employeeName: employee?.name ?? '—',
        phone: employee?.phone || '—',
        productName: product?.name ?? '—',
        planId: insurancePlanId(product),
        productDescription: product?.description ?? '—',
        enrolledAtText: formatInsuranceDateTime(insuranceEnrolledAt(policy)),
        periodText: formatInsurancePeriod(policy.effectiveTime, policy.expireTime),
        enrollmentStatus: getInsuranceEnrollmentDisplayStatus(policy),
      }
    }),
)

function decorateClaim(record: InsuranceClaimRecord) {
  const policy = store.insurancePolicies.find((item) => item.id === record.policyId)
  const employee = policy ? employeeMap.value[policy.employeeId] : undefined
  const product = policy ? productMap.value[policy.productId] : undefined
  const enterpriseId = resolveEnterpriseIdByEmployee(employee)
  return {
    ...record,
    policyNo: policy?.policyNo ?? '—',
    employeeName: employee?.name ?? '—',
    phone: record.contactPhone || employee?.phone || '—',
    productName: product?.name ?? '—',
    enterpriseName: enterpriseName(enterpriseId),
    matchesScope: matchesEnterprise(enterpriseId),
    recordedAtText: formatInsuranceDateTime(record.recordedAt),
    incidentTimeText: formatInsuranceDateTime(record.incidentTime),
    amountText: record.claimAmount != null ? `¥${record.claimAmount.toFixed(2)}` : '—',
  }
}

const claimRows = computed(() => {
  const text = claimKeyword.value.trim().toLowerCase()
  return store.insuranceClaimRecords
    .map(decorateClaim)
    .filter((row) => row.matchesScope)
    .filter((row) => !claimStatusFilter.value || row.status === claimStatusFilter.value)
    .filter((row) => {
      if (!text) return true
      return [row.policyNo, row.employeeName, row.phone, row.productName, row.enterpriseName, row.reason]
        .some((value) => String(value).toLowerCase().includes(text))
    })
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
})

const selectedClaim = computed(() => {
  const record = store.insuranceClaimRecords.find((item) => item.id === selectedClaimId.value)
  return record ? decorateClaim(record) : null
})

const selectedRow = computed(() =>
  selectedPolicy.value
    ? policyRows.value.find((row) => row.id === selectedPolicy.value?.id) ?? null
    : null,
)

const enterpriseNameById = computed(() =>
  Object.fromEntries(store.enterprises.map((item) => [item.id, item.name])),
)

function formatLinkedEnterprises(ids?: string[]) {
  if (!ids?.length) return '未关联'
  return ids.map((id) => enterpriseNameById.value[id] ?? id).join('、')
}

const enterpriseLinkOptions = computed(() => {
  const taken = new Map<string, string>()
  for (const product of store.insuranceProducts) {
    if (product.id === editingProductId.value) continue
    for (const id of product.enterpriseIds ?? []) taken.set(id, product.name)
  }
  const selected = new Set(productForm.enterpriseIds)
  return store.enterprises
    .filter((item) => item.status !== 'terminated' || selected.has(item.id))
    .map((item) => {
      const owner = taken.get(item.id)
      return {
        id: item.id,
        disabled: Boolean(owner),
        label: owner ? `${item.name}（已关联${owner}）` : item.name,
      }
    })
    .sort((a, b) => Number(a.disabled) - Number(b.disabled) || a.label.localeCompare(b.label, 'zh'))
})

function resetProductForm(product?: InsuranceProduct) {
  editingProductId.value = product?.id ?? ''
  productForm.name = product?.name ?? ''
  productForm.planId = product ? insurancePlanId(product) : ''
  productForm.type = product?.type ?? 'team_accident'
  productForm.provider = product?.provider ?? ''
  productForm.deathDisabilityAmount = product?.coverageScope?.deathDisabilityAmount ?? null
  productForm.medicalExpenseAmount = product?.coverageScope?.medicalExpenseAmount ?? null
  productForm.lostWageDailyAmount = product?.coverageScope?.lostWageDailyAmount ?? null
  productForm.suddenDeathAmount = product?.coverageScope?.suddenDeathAmount ?? null
  productForm.description = product?.description ?? ''
  productForm.enterpriseIds = [...(product?.enterpriseIds ?? [])]
}

function formatScopeAmount(amount: number | undefined, unit: string) {
  if (amount == null || Number.isNaN(amount)) return '—'
  return `${amount}${unit}`
}

function openViewProduct(product: InsuranceProduct) {
  viewingProduct.value = product
  productViewVisible.value = true
}

function openCreateProduct() {
  resetProductForm()
  productDialogVisible.value = true
}

function openEditProduct(product: InsuranceProduct) {
  resetProductForm(product)
  productDialogVisible.value = true
}

function saveProduct() {
  const payload = {
    name: productForm.name,
    planId: productForm.planId,
    type: productForm.type,
    provider: productForm.provider,
    coverageScope: {
      deathDisabilityAmount: Number(productForm.deathDisabilityAmount),
      medicalExpenseAmount: Number(productForm.medicalExpenseAmount),
      lostWageDailyAmount: Number(productForm.lostWageDailyAmount),
      suddenDeathAmount: Number(productForm.suddenDeathAmount),
    },
    description: productForm.description,
    ...(isPlatform.value ? { enterpriseIds: [...productForm.enterpriseIds] } : {}),
  }
  productSaving.value = true
  try {
    if (editingProductId.value) {
      store.updateInsuranceProduct(editingProductId.value, payload)
      ElMessage.success('产品已更新')
    } else {
      store.addInsuranceProduct(payload)
      ElMessage.success('产品已新增')
    }
    productDialogVisible.value = false
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '保存失败')
  } finally {
    productSaving.value = false
  }
}

async function removeProduct(product: InsuranceProduct) {
  try {
    await ElMessageBox.confirm(`确认删除保险产品「${product.name}」？`, '删除产品', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    store.removeInsuranceProduct(product.id)
    ElMessage.success('产品已删除')
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '删除失败')
  }
}

function openPolicyDetail(row: InsurancePolicy) {
  selectedPolicy.value = store.insurancePolicies.find((policy) => policy.id === row.id) ?? row
  detailVisible.value = true
}

function revokePolicyFile() {
  if (!policyFileUrl.value) return
  URL.revokeObjectURL(policyFileUrl.value)
  policyFileUrl.value = ''
}

function openPolicyFile() {
  const row = selectedRow.value
  if (!row) return
  const product = productMap.value[row.productId]
  revokePolicyFile()
  const blob = buildInsurancePolicyPdfBlob({
    policyNo: row.policyNo,
    employeeName: row.employeeName,
    phone: row.phone,
    enterpriseName: row.enterpriseName,
    departmentName: row.departmentName,
    productName: row.productName,
    planId: row.planId,
    provider: product?.provider || '—',
    productType: product ? getInsuranceProductTypeLabel(product.type) : '—',
    coverageText: formatInsuranceCoverageScope(product?.coverageScope),
    enrolledAtText: row.enrolledAtText,
    periodText: row.periodText,
    statusText: getInsuranceEnrollmentDisplayLabel(row.enrollmentStatus),
    description: row.productDescription,
  })
  policyFileUrl.value = URL.createObjectURL(blob)
  policyFileName.value = `${row.policyNo}.pdf`
  policyFileTitle.value = `保单文件 · ${row.policyNo}`
  policyFileVisible.value = true
}

function closePolicyFile() {
  policyFileVisible.value = false
  revokePolicyFile()
}

onBeforeUnmount(revokePolicyFile)

function claimActionLabel(status: InsuranceClaimStatus) {
  if (!isPlatform.value) return '查看'
  if (status === 'pending') return '审核'
  if (canEditInsuranceClaim(status)) return '编辑'
  return '查看'
}

function loadCommunicationDraft(record: InsuranceClaimRecord) {
  communicationDrafts.value = normalizeInsuranceClaimCommunications(record).map((item) => ({ ...item }))
  communicationEditingId.value = ''
  communicationDraftText.value = ''
}

function openClaimDetail(id: string) {
  const record = store.insuranceClaimRecords.find((item) => item.id === id)
  if (!record) return
  selectedClaimId.value = id
  progressStatus.value = canEditInsuranceClaim(record.status) ? record.status : 'reported'
  progressRemark.value = record.remark ?? ''
  loadCommunicationDraft(record)
  claimDetailVisible.value = true
}

function claimCommunicationList(record: InsuranceClaimRecord) {
  return normalizeInsuranceClaimCommunications(record)
}

function startAddCommunication() {
  if (communicationEditingId.value) {
    ElMessage.warning('请先确定或取消当前沟通记录')
    return
  }
  communicationEditingId.value = 'new'
  communicationDraftText.value = ''
}

function startEditCommunication(item: InsuranceClaimCommunication) {
  if (communicationEditingId.value && communicationEditingId.value !== item.id) {
    ElMessage.warning('请先确定或取消当前沟通记录')
    return
  }
  communicationEditingId.value = item.id
  communicationDraftText.value = item.content
}

function cancelCommunicationEdit() {
  communicationEditingId.value = ''
  communicationDraftText.value = ''
}

function confirmCommunication() {
  const text = communicationDraftText.value.trim()
  if (!text) {
    ElMessage.warning('请填写沟通记录')
    return
  }
  const now = new Date().toISOString()
  if (communicationEditingId.value === 'new') {
    communicationDrafts.value.push({
      id: generateId('ins_comm'),
      content: text,
      createdAt: now,
    })
  } else {
    const current = communicationDrafts.value.find((item) => item.id === communicationEditingId.value)
    if (current) {
      current.content = text
      current.updatedAt = now
    }
  }
  cancelCommunicationEdit()
}

function removeCommunication(id: string) {
  communicationDrafts.value = communicationDrafts.value.filter((item) => item.id !== id)
  if (communicationEditingId.value === id) cancelCommunicationEdit()
}

function approveClaim() {
  if (!selectedClaim.value) return
  try {
    store.approveInsuranceClaim(selectedClaim.value.id)
    progressStatus.value = 'reported'
    progressRemark.value = selectedClaim.value.remark ?? ''
    loadCommunicationDraft(selectedClaim.value)
    ElMessage.success('已通过审批，状态已变更为已提报')
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '审批失败')
  }
}

function openReject() {
  rejectReason.value = ''
  rejectReasonError.value = ''
  rejectVisible.value = true
}

function confirmReject() {
  if (!selectedClaim.value) return
  if (!rejectReason.value.trim()) {
    rejectReasonError.value = '请填写驳回原因'
    return
  }
  rejectReasonError.value = ''
  try {
    store.rejectInsuranceClaim(selectedClaim.value.id, rejectReason.value)
    rejectVisible.value = false
    ElMessage.success('已驳回该理赔申请')
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '审批失败')
  }
}

function saveClaimProgress() {
  if (!selectedClaim.value) return
  if (communicationEditingId.value) {
    ElMessage.warning('请先确定或取消当前沟通记录')
    return
  }
  if (!communicationDrafts.value.length) {
    ElMessage.warning('请填写沟通记录')
    return
  }
  try {
    store.updateInsuranceClaimProgress(
      selectedClaim.value.id,
      progressStatus.value,
      communicationDrafts.value,
      progressRemark.value,
    )
    ElMessage.success('理赔记录已保存')
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '保存失败')
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">保险管理</h2>
        <p class="text-muted">维护保险产品，并按日查看投保明细。理赔由灵工提交，审批通过后为已提报，已办结不可再编辑。</p>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="保险产品维护" name="products">
        <div v-if="isPlatform" class="page-toolbar">
          <el-button type="primary" @click="openCreateProduct">新增产品</el-button>
          <span class="hint inline">一个方案可关联多家企业，每家企业只能配置一个方案</span>
        </div>
        <el-table :data="visibleProducts" stripe border>
          <el-table-column prop="name" label="产品名称" min-width="180" />
          <el-table-column label="产品方案 ID" min-width="140">
            <template #default="{ row }">{{ insurancePlanId(row) }}</template>
          </el-table-column>
          <el-table-column label="险种" width="110">
            <template #default="{ row }">{{ getInsuranceProductTypeLabel(row.type) }}</template>
          </el-table-column>
          <el-table-column label="承保公司" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.provider || '—' }}</template>
          </el-table-column>
          <el-table-column label="保障范围" min-width="280" show-overflow-tooltip>
            <template #default="{ row }">{{ formatInsuranceCoverageScope(row.coverageScope) }}</template>
          </el-table-column>
          <el-table-column label="关联企业" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">{{ formatLinkedEnterprises(row.enterpriseIds) }}</template>
          </el-table-column>
          <el-table-column prop="description" label="产品介绍" min-width="280" show-overflow-tooltip />
          <el-table-column label="操作" :width="isPlatform ? 180 : 80" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openViewProduct(row)">查看</el-button>
              <template v-if="isPlatform">
                <el-button link type="primary" @click="openEditProduct(row)">编辑</el-button>
                <el-button link type="danger" @click="removeProduct(row)">删除</el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="保险管理" name="policies">
        <div class="page-toolbar">
          <EnterpriseScopeSelect
            v-if="showEnterpriseControl"
            v-model="enterpriseFilter"
            mode="filter"
            width="180px"
          />
          <el-select
            v-model="departmentFilter"
            clearable
            filterable
            placeholder="全部部门"
            style="width: 220px"
          >
            <el-option
              v-for="item in departmentOptions"
              :key="item.id"
              :label="item.label"
              :value="item.id"
            />
          </el-select>
          <el-date-picker
            v-model="workDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="日期"
            :clearable="false"
            style="width: 150px"
          />
          <el-input v-model="nameKeyword" placeholder="姓名" clearable style="width: 140px" />
          <el-input v-model="phoneKeyword" placeholder="手机号" clearable style="width: 150px" />
          <el-input v-model="productKeyword" placeholder="产品名称" clearable style="width: 180px" />
          <el-input v-model="policyNoKeyword" placeholder="保单号" clearable style="width: 180px" />
          <span class="hint inline">演示当前时间 {{ demoNowLabel }} · 当日 {{ policyRows.length }} 条</span>
        </div>
        <el-table :data="policyRows" stripe border>
          <el-table-column prop="enterpriseName" label="企业" min-width="160" show-overflow-tooltip />
          <el-table-column prop="departmentName" label="部门" min-width="140" show-overflow-tooltip />
          <el-table-column prop="employeeName" label="姓名" width="90" />
          <el-table-column prop="phone" label="手机号" width="130" />
          <el-table-column prop="policyNo" label="保单号" min-width="160" />
          <el-table-column prop="productName" label="产品名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="enrolledAtText" label="投保时间" width="150" />
          <el-table-column prop="periodText" label="投保期限" min-width="280" show-overflow-tooltip />
          <el-table-column label="投保状态" width="100" fixed="right">
            <template #default="{ row }">
              <el-tag :type="getInsuranceEnrollmentDisplayTagType(row.enrollmentStatus)" size="small">
                {{ getInsuranceEnrollmentDisplayLabel(row.enrollmentStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openPolicyDetail(row)">查看保单</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="理赔申请" name="claims">
        <div class="page-toolbar">
          <EnterpriseScopeSelect
            v-if="showEnterpriseControl"
            v-model="enterpriseFilter"
            mode="filter"
            width="180px"
          />
          <el-select v-model="claimStatusFilter" clearable placeholder="全部状态" style="width: 140px">
            <el-option
              v-for="item in insuranceClaimStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-input
            v-model="claimKeyword"
            placeholder="搜索企业、姓名、手机号、保单号"
            clearable
            style="width: 280px"
            prefix-icon="Search"
          />
          <span class="hint inline">{{ claimRows.length }} 条</span>
        </div>
        <el-table :data="claimRows" stripe border>
          <el-table-column prop="enterpriseName" label="企业" min-width="150" show-overflow-tooltip />
          <el-table-column prop="employeeName" label="姓名" width="90" />
          <el-table-column prop="phone" label="手机号" width="130" />
          <el-table-column prop="policyNo" label="保单号" min-width="150" />
          <el-table-column prop="reason" label="事故经过" min-width="180" show-overflow-tooltip />
          <el-table-column prop="recordedAtText" label="申请时间" width="150" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getInsuranceClaimStatusTagType(row.status)" size="small">
                {{ getInsuranceClaimStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openClaimDetail(row.id)">{{ claimActionLabel(row.status) }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="productViewVisible" title="查看保险产品" width="640px">
      <el-descriptions v-if="viewingProduct" :column="1" border>
        <el-descriptions-item label="产品名称">{{ viewingProduct.name }}</el-descriptions-item>
        <el-descriptions-item label="产品方案 ID">{{ insurancePlanId(viewingProduct) }}</el-descriptions-item>
        <el-descriptions-item label="险种">{{ getInsuranceProductTypeLabel(viewingProduct.type) }}</el-descriptions-item>
        <el-descriptions-item label="承保公司">{{ viewingProduct.provider || '—' }}</el-descriptions-item>
        <el-descriptions-item label="工伤身故残疾额度">
          {{ formatScopeAmount(viewingProduct.coverageScope?.deathDisabilityAmount, '万') }}
        </el-descriptions-item>
        <el-descriptions-item label="工伤医疗费用">
          {{ formatScopeAmount(viewingProduct.coverageScope?.medicalExpenseAmount, '万') }}
        </el-descriptions-item>
        <el-descriptions-item label="工伤误工补偿">
          {{ formatScopeAmount(viewingProduct.coverageScope?.lostWageDailyAmount, '元/天') }}
        </el-descriptions-item>
        <el-descriptions-item label="工伤猝死">
          {{ formatScopeAmount(viewingProduct.coverageScope?.suddenDeathAmount, '万') }}
        </el-descriptions-item>
        <el-descriptions-item label="产品介绍">{{ viewingProduct.description || '—' }}</el-descriptions-item>
        <el-descriptions-item label="关联企业">{{ formatLinkedEnterprises(viewingProduct.enterpriseIds) }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="productViewVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="productDialogVisible"
      :title="editingProductId ? '编辑保险产品' : '新增保险产品'"
      width="640px"
    >
      <el-form label-width="150px">
        <el-form-item label="产品名称" required>
          <el-input v-model="productForm.name" maxlength="40" placeholder="请输入产品名称" />
        </el-form-item>
        <el-form-item label="产品方案 ID" required>
          <el-input v-model="productForm.planId" maxlength="40" placeholder="请输入产品方案 ID" />
        </el-form-item>
        <el-form-item label="险种" required>
          <el-select v-model="productForm.type" placeholder="请选择险种" style="width: 100%">
            <el-option
              v-for="item in insuranceProductTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="承保公司" required>
          <el-input v-model="productForm.provider" maxlength="40" placeholder="请输入承保公司" />
        </el-form-item>
        <div class="coverage-title">保障范围</div>
        <el-form-item label="工伤身故残疾额度" required>
          <el-input-number
            v-model="productForm.deathDisabilityAmount"
            :min="0.01"
            :precision="2"
            :step="10"
            controls-position="right"
          />
          <span class="unit">万元</span>
        </el-form-item>
        <el-form-item label="工伤医疗费用" required>
          <el-input-number
            v-model="productForm.medicalExpenseAmount"
            :min="0.01"
            :precision="2"
            :step="1"
            controls-position="right"
          />
          <span class="unit">万元</span>
        </el-form-item>
        <el-form-item label="工伤误工补偿" required>
          <el-input-number
            v-model="productForm.lostWageDailyAmount"
            :min="0.01"
            :precision="2"
            :step="10"
            controls-position="right"
          />
          <span class="unit">元/天</span>
        </el-form-item>
        <el-form-item label="工伤猝死" required>
          <el-input-number
            v-model="productForm.suddenDeathAmount"
            :min="0.01"
            :precision="2"
            :step="10"
            controls-position="right"
          />
          <span class="unit">万元</span>
        </el-form-item>
        <el-form-item label="产品介绍" required>
          <el-input
            v-model="productForm.description"
            type="textarea"
            :rows="4"
            maxlength="200"
            show-word-limit
            placeholder="请输入产品介绍"
          />
        </el-form-item>
        <el-form-item v-if="isPlatform" label="关联企业">
          <el-select
            v-model="productForm.enterpriseIds"
            multiple
            filterable
            clearable
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择企业，可多选"
            style="width: 100%"
          >
            <el-option
              v-for="item in enterpriseLinkOptions"
              :key="item.id"
              :label="item.label"
              :value="item.id"
              :disabled="item.disabled"
            />
          </el-select>
          <p class="field-hint">一个保险方案可关联多家企业。已被其他方案占用的企业不可选，一家企业只能配置一个保险方案。</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="productDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="productSaving" @click="saveProduct">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="查看保单" size="440px">
      <el-descriptions v-if="selectedRow" :column="1" border>
        <el-descriptions-item label="保单号">{{ selectedRow.policyNo }}</el-descriptions-item>
        <el-descriptions-item label="企业">{{ selectedRow.enterpriseName }}</el-descriptions-item>
        <el-descriptions-item label="部门">{{ selectedRow.departmentName }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ selectedRow.employeeName }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ selectedRow.phone }}</el-descriptions-item>
        <el-descriptions-item label="产品名称">{{ selectedRow.productName }}</el-descriptions-item>
        <el-descriptions-item label="产品方案 ID">{{ selectedRow.planId }}</el-descriptions-item>
        <el-descriptions-item label="产品介绍">{{ selectedRow.productDescription }}</el-descriptions-item>
        <el-descriptions-item label="投保时间">{{ selectedRow.enrolledAtText }}</el-descriptions-item>
        <el-descriptions-item label="投保期限">{{ selectedRow.periodText }}</el-descriptions-item>
        <el-descriptions-item label="投保状态">
          <div class="status-line">
            <el-tag :type="getInsuranceEnrollmentDisplayTagType(selectedRow.enrollmentStatus)" size="small">
              {{ getInsuranceEnrollmentDisplayLabel(selectedRow.enrollmentStatus) }}
            </el-tag>
            <el-button link type="primary" @click="openPolicyFile">保单下载</el-button>
          </div>
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <el-dialog
      :model-value="policyFileVisible"
      :title="policyFileTitle"
      width="860px"
      top="4vh"
      append-to-body
      destroy-on-close
      class="policy-file-dialog"
      @update:model-value="(open: boolean) => (open ? (policyFileVisible = true) : closePolicyFile())"
    >
      <div class="policy-file-meta">
        <span>{{ policyFileName }}</span>
        <a v-if="policyFileUrl" :href="policyFileUrl" :download="policyFileName">下载 PDF</a>
      </div>
      <iframe v-if="policyFileUrl" :src="policyFileUrl" class="policy-file-frame" title="保单文件" />
    </el-dialog>

    <el-dialog v-model="claimDetailVisible" title="理赔申请" width="640px">
      <template v-if="selectedClaim">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="姓名">{{ selectedClaim.employeeName }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ selectedClaim.phone }}</el-descriptions-item>
          <el-descriptions-item label="保单号">{{ selectedClaim.policyNo }}</el-descriptions-item>
          <el-descriptions-item label="产品">{{ selectedClaim.productName }}</el-descriptions-item>
          <el-descriptions-item label="事故时间">{{ selectedClaim.incidentTimeText }}</el-descriptions-item>
          <el-descriptions-item label="事故地点">{{ selectedClaim.incidentLocation }}</el-descriptions-item>
          <el-descriptions-item label="受伤情况">{{ selectedClaim.injury }}</el-descriptions-item>
          <el-descriptions-item label="申请金额">{{ selectedClaim.amountText }}</el-descriptions-item>
          <el-descriptions-item label="事故经过" :span="2">{{ selectedClaim.reason }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getInsuranceClaimStatusTagType(selectedClaim.status)" size="small">
              {{ getInsuranceClaimStatusLabel(selectedClaim.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="申请时间">{{ selectedClaim.recordedAtText }}</el-descriptions-item>
        </el-descriptions>
        <div class="materials">
          <div class="materials-title">理赔资料</div>
          <div v-for="file in selectedClaim.materials" :key="file.key" class="material-row">
            <span>{{ file.label }}</span>
            <b>{{ file.fileName }}</b>
          </div>
          <div v-if="!selectedClaim.materials.length" class="material-empty">未上传资料</div>
        </div>
        <el-form
          v-if="isPlatform && canEditInsuranceClaim(selectedClaim.status)"
          label-width="88px"
          class="claim-form"
        >
          <el-form-item label="沟通记录" required>
            <div class="comm-list">
              <div v-for="item in communicationDrafts" :key="item.id" class="comm-item">
                <template v-if="communicationEditingId === item.id">
                  <el-input
                    v-model="communicationDraftText"
                    type="textarea"
                    :rows="2"
                    maxlength="500"
                    show-word-limit
                    placeholder="请填写沟通记录"
                  />
                  <div class="comm-actions">
                    <el-button link type="primary" @click="confirmCommunication">确定</el-button>
                    <el-button link @click="cancelCommunicationEdit">取消</el-button>
                  </div>
                </template>
                <template v-else>
                  <p>{{ item.content }}</p>
                  <span class="comm-time">{{ formatInsuranceDateTime(item.updatedAt || item.createdAt) }}</span>
                  <div class="comm-actions">
                    <el-button link type="primary" @click="startEditCommunication(item)">编辑</el-button>
                    <el-button link type="danger" @click="removeCommunication(item.id)">删除</el-button>
                  </div>
                </template>
              </div>
              <div v-if="communicationEditingId === 'new'" class="comm-item">
                <el-input
                  v-model="communicationDraftText"
                  type="textarea"
                  :rows="2"
                  maxlength="500"
                  show-word-limit
                  placeholder="请填写沟通记录"
                />
                <div class="comm-actions">
                  <el-button link type="primary" @click="confirmCommunication">确定</el-button>
                  <el-button link @click="cancelCommunicationEdit">取消</el-button>
                </div>
              </div>
              <el-button v-else link type="primary" @click="startAddCommunication">新增</el-button>
            </div>
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="progressRemark" maxlength="80" placeholder="选填" />
          </el-form-item>
          <el-form-item label="状态" required>
            <el-select v-model="progressStatus" style="width: 160px">
              <el-option
                v-for="item in insuranceClaimProgressOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-form>
        <div v-else class="claim-readonly">
          <div v-if="claimCommunicationList(selectedClaim).length" class="comm-list">
            <div class="materials-title">沟通记录</div>
            <div v-for="item in claimCommunicationList(selectedClaim)" :key="item.id" class="comm-item">
              <p>{{ item.content }}</p>
              <span class="comm-time">{{ formatInsuranceDateTime(item.updatedAt || item.createdAt) }}</span>
            </div>
          </div>
          <p v-else-if="selectedClaim.status === 'closed'">沟通记录：—</p>
          <p v-if="selectedClaim.status === 'rejected' && (selectedClaim.rejectReason || selectedClaim.remark)">
            驳回原因：{{ selectedClaim.rejectReason || selectedClaim.remark }}
          </p>
          <p v-else-if="selectedClaim.remark">备注：{{ selectedClaim.remark }}</p>
        </div>
      </template>
      <template #footer>
        <el-button @click="claimDetailVisible = false">关闭</el-button>
        <template v-if="isPlatform && selectedClaim?.status === 'pending'">
          <el-button type="danger" plain @click="openReject">驳回</el-button>
          <el-button type="primary" @click="approveClaim">审批通过</el-button>
        </template>
        <el-button
          v-else-if="isPlatform && selectedClaim && canEditInsuranceClaim(selectedClaim.status)"
          type="primary"
          @click="saveClaimProgress"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="rejectVisible" title="驳回理赔申请" width="480px" append-to-body>
      <p class="claim-hint">确认驳回该理赔申请？驳回后灵工可重新申请。</p>
      <el-form label-width="88px">
        <el-form-item label="驳回原因" required :error="rejectReasonError">
          <el-input
            v-model="rejectReason"
            type="textarea"
            :rows="4"
            maxlength="1000"
            show-word-limit
            placeholder="请填写驳回原因"
            @input="rejectReasonError = ''"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.hint.inline {
  margin: 0;
  line-height: 32px;
}

.unit {
  margin-left: 8px;
  color: #909399;
}

.field-hint {
  width: 100%;
  margin: 6px 0 0;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}

.coverage-title {
  margin: 4px 0 12px;
  padding-left: 8px;
  border-left: 3px solid #4fd1c5;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.status-line {
  display: flex;
  align-items: center;
  gap: 12px;
}

.policy-file-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  color: #606266;
  font-size: 13px;
}

.policy-file-meta a {
  color: #0f766e;
}

.policy-file-frame {
  width: 100%;
  height: 70vh;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.claim-hint {
  margin: 0 0 12px;
  color: #909399;
  font-size: 13px;
}

.claim-readonly {
  margin-top: 14px;
  color: #606266;
  font-size: 13px;
  line-height: 1.6;
}

.claim-readonly p {
  margin: 0;
}

.comm-list {
  width: 100%;
}

.comm-item {
  margin-bottom: 8px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fafafa;
}

.comm-item p {
  margin: 0;
  color: #303133;
  line-height: 1.5;
  white-space: pre-wrap;
}

.comm-time {
  display: block;
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
}

.comm-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.claim-form {
  margin-top: 16px;
}

.materials {
  margin-top: 14px;
}

.materials-title {
  margin-bottom: 8px;
  font-size: 13px;
  color: #606266;
}

.material-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
  color: #909399;
}

.material-row b {
  color: #303133;
  font-weight: 500;
}

.material-empty {
  font-size: 13px;
  color: #909399;
}
</style>
