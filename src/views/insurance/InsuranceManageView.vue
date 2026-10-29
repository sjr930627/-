<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import { SCHEDULE_DEMO_NOW, SCHEDULE_DEMO_TODAY } from '@/constants/schedule'
import { getDepartmentName } from '@/utils'
import { resolveEnterpriseIdByEmployee } from '@/utils/enterpriseScope'
import type { InsurancePolicy, InsuranceProduct } from '@/types'
import {
  canAdminCancelInsurancePolicy,
  formatCoverageAmount,
  formatInsuranceDateTime,
  formatInsurancePeriod,
  getInsuranceEnrollmentDisplayLabel,
  getInsuranceEnrollmentDisplayStatus,
  getInsuranceEnrollmentDisplayTagType,
  insuranceEnrolledAt,
  insurancePlanId,
} from '@/services/insurance'

const store = useAppStore()
const { enterpriseFilter, matchesEnterprise, enterpriseName, showEnterpriseControl } =
  useEnterpriseScope('filter')

const activeTab = ref<'products' | 'policies'>('policies')
const workDate = ref(SCHEDULE_DEMO_TODAY)
const keyword = ref('')
const detailVisible = ref(false)
const selectedPolicy = ref<InsurancePolicy | null>(null)
const claimVisible = ref(false)
const productDialogVisible = ref(false)
const productSaving = ref(false)
const editingProductId = ref('')

const productForm = reactive({
  name: '',
  planId: '',
  coverageAmount: 50,
  description: '',
})

const productMap = computed(() =>
  Object.fromEntries(store.insuranceProducts.map((product) => [product.id, product])),
)

const employeeMap = computed(() =>
  Object.fromEntries(store.employees.map((employee) => [employee.id, employee])),
)

const demoNowLabel = formatInsuranceDateTime(SCHEDULE_DEMO_NOW)

const policyRows = computed(() =>
  store.insurancePolicies
    .filter((policy) => {
      if (policy.workDate !== workDate.value) return false
      const employee = employeeMap.value[policy.employeeId]
      if (!matchesEnterprise(resolveEnterpriseIdByEmployee(employee))) return false
      if (!keyword.value.trim()) return true
      const text = keyword.value.trim().toLowerCase()
      const product = productMap.value[policy.productId]
      const department = employee
        ? getDepartmentName(store.departments, employee.departmentId)
        : ''
      return [
        policy.policyNo,
        employee?.name,
        employee?.phone,
        product?.name,
        enterpriseName(resolveEnterpriseIdByEmployee(employee)),
        department,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text))
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
        coverageText: formatCoverageAmount(policy.coverageAmount ?? product?.coverageAmount),
        enrolledAtText: formatInsuranceDateTime(insuranceEnrolledAt(policy)),
        periodText: formatInsurancePeriod(policy.effectiveTime, policy.expireTime),
        enrollmentStatus: getInsuranceEnrollmentDisplayStatus(policy),
        canCancel: canAdminCancelInsurancePolicy(policy),
      }
    }),
)

const selectedRow = computed(() =>
  selectedPolicy.value
    ? policyRows.value.find((row) => row.id === selectedPolicy.value?.id) ?? null
    : null,
)

function resetProductForm(product?: InsuranceProduct) {
  editingProductId.value = product?.id ?? ''
  productForm.name = product?.name ?? ''
  productForm.planId = product ? insurancePlanId(product) : ''
  productForm.coverageAmount = product?.coverageAmount ?? 50
  productForm.description = product?.description ?? ''
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
    coverageAmount: Number(productForm.coverageAmount),
    description: productForm.description,
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

function openClaimRecords(row?: { enrollmentStatus?: string }) {
  if (row?.enrollmentStatus === 'cancelled') {
    ElMessage.warning('已退保保单不可申请理赔')
    return
  }
  claimVisible.value = true
}

async function confirmCancel(row: { id: string; policyNo: string; employeeName: string; canCancel: boolean }) {
  if (!row.canCancel) {
    ElMessage.warning('仅支持当天投保后 2 小时内退保')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认为 ${row.employeeName} 退保 ${row.policyNo}？退保后保障立即终止。`,
      '退保确认',
      {
        type: 'warning',
        confirmButtonText: '确认退保',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }
  const result = store.cancelInsurancePolicy(row.id)
  if (!result.ok) {
    ElMessage.warning(result.message)
    return
  }
  ElMessage.success(result.message)
  if (selectedPolicy.value?.id === row.id) {
    selectedPolicy.value = store.insurancePolicies.find((policy) => policy.id === row.id) ?? null
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">保险管理</h2>
        <p class="text-muted">维护保险产品，并按日查看投保明细。退保仅限投保当天、投保后 2 小时内。</p>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="保险产品维护" name="products">
        <div class="page-toolbar">
          <el-button type="primary" @click="openCreateProduct">新增产品</el-button>
        </div>
        <el-table :data="store.insuranceProducts" stripe border>
          <el-table-column prop="name" label="产品名称" min-width="180" />
          <el-table-column label="产品方案 ID" min-width="140">
            <template #default="{ row }">{{ insurancePlanId(row) }}</template>
          </el-table-column>
          <el-table-column label="产品额度" width="120" align="right">
            <template #default="{ row }">{{ formatCoverageAmount(row.coverageAmount) }}</template>
          </el-table-column>
          <el-table-column prop="description" label="产品介绍" min-width="280" show-overflow-tooltip />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditProduct(row)">编辑</el-button>
              <el-button link type="danger" @click="removeProduct(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="保险管理" name="policies">
        <div class="page-toolbar">
          <el-date-picker
            v-model="workDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="投保日期"
            :clearable="false"
            style="width: 160px"
          />
          <EnterpriseScopeSelect
            v-if="showEnterpriseControl"
            v-model="enterpriseFilter"
            mode="filter"
            width="180px"
          />
          <el-input
            v-model="keyword"
            placeholder="搜索企业、部门、姓名、手机号、保单号"
            clearable
            style="width: 280px"
            prefix-icon="Search"
          />
          <span class="hint inline">演示当前时间 {{ demoNowLabel }} · 当日 {{ policyRows.length }} 条</span>
        </div>
        <el-table :data="policyRows" stripe border>
          <el-table-column prop="enterpriseName" label="企业" min-width="160" show-overflow-tooltip />
          <el-table-column prop="departmentName" label="部门" min-width="140" show-overflow-tooltip />
          <el-table-column prop="employeeName" label="姓名" width="90" />
          <el-table-column prop="phone" label="手机号" width="130" />
          <el-table-column prop="policyNo" label="保单号" min-width="160" />
          <el-table-column prop="productName" label="产品名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="coverageText" label="产品额度" width="100" align="right" />
          <el-table-column prop="enrolledAtText" label="投保时间" width="150" />
          <el-table-column prop="periodText" label="投保期限" min-width="280" show-overflow-tooltip />
          <el-table-column label="投保状态" width="100" fixed="right">
            <template #default="{ row }">
              <el-tag :type="getInsuranceEnrollmentDisplayTagType(row.enrollmentStatus)" size="small">
                {{ getInsuranceEnrollmentDisplayLabel(row.enrollmentStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="250" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openPolicyDetail(row)">查看保单</el-button>
              <el-tooltip
                :disabled="row.canCancel"
                content="仅支持当天投保后 2 小时内退保"
                placement="top"
              >
                <span class="action-wrap">
                  <el-button
                    link
                    type="danger"
                    :disabled="!row.canCancel"
                    @click="confirmCancel(row)"
                  >
                    退保
                  </el-button>
                </span>
              </el-tooltip>
              <el-tooltip
                :disabled="row.enrollmentStatus !== 'cancelled'"
                content="已退保保单不可申请理赔"
                placement="top"
              >
                <span class="action-wrap">
                  <el-button
                    link
                    type="primary"
                    :disabled="row.enrollmentStatus === 'cancelled'"
                    @click="openClaimRecords(row)"
                  >
                    申请理赔记录
                  </el-button>
                </span>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="productDialogVisible"
      :title="editingProductId ? '编辑保险产品' : '新增保险产品'"
      width="520px"
    >
      <el-form label-width="110px">
        <el-form-item label="产品名称" required>
          <el-input v-model="productForm.name" maxlength="40" placeholder="请输入产品名称" />
        </el-form-item>
        <el-form-item label="产品方案 ID" required>
          <el-input v-model="productForm.planId" maxlength="40" placeholder="请输入产品方案 ID" />
        </el-form-item>
        <el-form-item label="产品额度" required>
          <el-input-number
            v-model="productForm.coverageAmount"
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
        <el-descriptions-item label="产品额度">{{ selectedRow.coverageText }}</el-descriptions-item>
        <el-descriptions-item label="产品介绍">{{ selectedRow.productDescription }}</el-descriptions-item>
        <el-descriptions-item label="投保时间">{{ selectedRow.enrolledAtText }}</el-descriptions-item>
        <el-descriptions-item label="投保期限">{{ selectedRow.periodText }}</el-descriptions-item>
        <el-descriptions-item label="投保状态">
          <el-tag :type="getInsuranceEnrollmentDisplayTagType(selectedRow.enrollmentStatus)" size="small">
            {{ getInsuranceEnrollmentDisplayLabel(selectedRow.enrollmentStatus) }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
      <div v-if="selectedRow?.canCancel" class="drawer-actions">
        <el-button type="danger" plain @click="confirmCancel(selectedRow)">退保</el-button>
      </div>
    </el-drawer>

    <el-dialog v-model="claimVisible" title="申请理赔记录" width="420px">
      <el-empty description="理赔流程暂不处理" />
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

.action-wrap {
  display: inline-flex;
  margin: 0 8px;
}

.drawer-actions {
  margin-top: 20px;
}
</style>
