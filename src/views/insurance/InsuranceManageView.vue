<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import { resolveEnterpriseIdByEmployee } from '@/utils/enterpriseScope'
import type { InsurancePolicy, InsurancePolicyStatus } from '@/types'
import {
  getInsurancePolicyStatusLabel,
  getInsurancePolicyStatusTagType,
  getInsuranceProductTypeLabel,
  summarizeEmployeeInsurance,
} from '@/services/insurance'

const store = useAppStore()
const { enterpriseFilter, matchesEnterprise, enterpriseName, showEnterpriseControl } =
  useEnterpriseScope('filter')
const activeTab = ref<'policies' | 'employees' | 'products'>('policies')
const keyword = ref('')
const statusFilter = ref<InsurancePolicyStatus | ''>('')
const dateRange = ref<[string, string] | null>(null)
const detailVisible = ref(false)
const selectedPolicy = ref<InsurancePolicy | null>(null)
const employeeDetailVisible = ref(false)
const selectedEmployeeId = ref('')

const productMap = computed(() =>
  Object.fromEntries(store.insuranceProducts.map((p) => [p.id, p])),
)

const employeeMap = computed(() =>
  Object.fromEntries(store.employees.map((e) => [e.id, e])),
)

const stats = computed(() => {
  const all = store.insurancePolicies
  const active = all.filter((p) => p.status === 'active').length
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = all.filter((p) => p.workDate === today).length
  const premium = Math.round(all.reduce((s, p) => s + p.premium, 0) * 100) / 100
  return { total: all.length, active, todayCount, premium }
})

const policyRows = computed(() =>
  [...store.insurancePolicies]
    .filter((p) => {
      const emp = employeeMap.value[p.employeeId]
      if (!matchesEnterprise(resolveEnterpriseIdByEmployee(emp))) return false
      if (statusFilter.value && p.status !== statusFilter.value) return false
      if (dateRange.value) {
        const [start, end] = dateRange.value
        if (p.workDate < start || p.workDate > end) return false
      }
      if (keyword.value.trim()) {
        const kw = keyword.value.trim().toLowerCase()
        const emp = employeeMap.value[p.employeeId]
        const prod = productMap.value[p.productId]
        if (
          !p.policyNo.toLowerCase().includes(kw) &&
          !emp?.name.includes(kw) &&
          !emp?.employeeNo.toLowerCase().includes(kw) &&
          !prod?.name.includes(kw)
        ) {
          return false
        }
      }
      return true
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => ({
      ...p,
      enterpriseName: enterpriseName(resolveEnterpriseIdByEmployee(employeeMap.value[p.employeeId])),
      employeeName: employeeMap.value[p.employeeId]?.name ?? '-',
      employeeNo: employeeMap.value[p.employeeId]?.employeeNo ?? '-',
      productName: productMap.value[p.productId]?.name ?? '-',
      provider: productMap.value[p.productId]?.provider ?? '-',
      coverage: productMap.value[p.productId]?.coverageAmount ?? 0,
    })),
)

const employeeRows = computed(() =>
  store.activeEmployees
    .filter((emp) => matchesEnterprise(resolveEnterpriseIdByEmployee(emp)))
    .map((emp) => {
      const summary = summarizeEmployeeInsurance(store.insurancePolicies, emp.id)
      const latestPolicy = summary.latest
      return {
        employeeId: emp.id,
        enterpriseName: enterpriseName(resolveEnterpriseIdByEmployee(emp)),
        name: emp.name,
        employeeNo: emp.employeeNo,
        position: emp.position,
        totalPolicies: summary.total,
        activePolicies: summary.active,
        totalPremium: summary.totalPremium,
        latestPolicyNo: latestPolicy?.policyNo ?? '-',
        latestStatus: latestPolicy?.status,
        latestDate: latestPolicy?.workDate ?? '-',
      }
    })
    .filter((row) => {
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim()
      return row.name.includes(kw) || row.employeeNo.toLowerCase().includes(kw.toLowerCase())
    }),
)

const employeePolicies = computed(() =>
  selectedEmployeeId.value ? store.getEmployeePolicies(selectedEmployeeId.value) : [],
)

function openPolicyDetail(row: InsurancePolicy) {
  selectedPolicy.value = row
  detailVisible.value = true
}

function openEmployeeDetail(employeeId: string) {
  selectedEmployeeId.value = employeeId
  employeeDetailVisible.value = true
}

function handleCancelPolicy(id: string) {
  if (store.cancelInsurancePolicy(id)) {
    ElMessage.success('保单已退保')
    if (selectedPolicy.value?.id === id) {
      selectedPolicy.value = { ...selectedPolicy.value, status: 'cancelled' }
    }
  } else {
    ElMessage.warning('仅保障中的保单可退保')
  }
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN')
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">保险管理</h2>
        <p class="text-muted">C 端上班打卡后自动按日投保，可查看人员投保记录与保单详情</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-item">
        <span class="stat-label">累计保单</span>
        <span class="stat-value">{{ stats.total }}</span>
      </div>
      <div class="stat-item active">
        <span class="stat-label">保障中</span>
        <span class="stat-value">{{ stats.active }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">今日投保</span>
        <span class="stat-value">{{ stats.todayCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">累计保费（元）</span>
        <span class="stat-value">{{ stats.premium.toFixed(2) }}</span>
      </div>
    </div>

    <div class="page-toolbar">
      <EnterpriseScopeSelect
        v-if="showEnterpriseControl"
        v-model="enterpriseFilter"
        mode="filter"
        width="180px"
      />
      <el-input
        v-model="keyword"
        placeholder="搜索保单号、姓名、工号..."
        clearable
        style="width: 240px"
        prefix-icon="Search"
      />
      <el-select
        v-if="activeTab === 'policies'"
        v-model="statusFilter"
        placeholder="保单状态"
        clearable
        style="width: 140px"
      >
        <el-option label="保障中" value="active" />
        <el-option label="已过期" value="expired" />
        <el-option label="已退保" value="cancelled" />
        <el-option label="待生效" value="pending" />
      </el-select>
      <el-date-picker
        v-if="activeTab === 'policies'"
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 260px"
      />
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="保单记录" name="policies">
        <el-table :data="policyRows" stripe border>
          <el-table-column prop="enterpriseName" label="企业" min-width="160" show-overflow-tooltip />
          <el-table-column prop="policyNo" label="保单号" min-width="150" />
          <el-table-column prop="employeeName" label="姓名" width="100" />
          <el-table-column prop="employeeNo" label="工号" width="100" />
          <el-table-column prop="productName" label="保险产品" min-width="160" />
          <el-table-column prop="workDate" label="工作日期" width="110" />
          <el-table-column label="保费" width="80" align="right">
            <template #default="{ row }">¥{{ row.premium.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="保额" width="90" align="right">
            <template #default="{ row }">{{ row.coverage }}万</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="getInsurancePolicyStatusTagType(row.status)" size="small">
                {{ getInsurancePolicyStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openPolicyDetail(row)">详情</el-button>
              <el-button
                v-if="row.status === 'active'"
                link
                type="danger"
                @click="handleCancelPolicy(row.id)"
              >
                退保
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="人员投保概况" name="employees">
        <el-table :data="employeeRows" stripe border>
          <el-table-column prop="enterpriseName" label="企业" min-width="160" show-overflow-tooltip />
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column prop="employeeNo" label="工号" width="100" />
          <el-table-column prop="position" label="岗位" min-width="120" />
          <el-table-column prop="totalPolicies" label="累计保单" width="90" align="center" />
          <el-table-column prop="activePolicies" label="保障中" width="90" align="center">
            <template #default="{ row }">
              <span :class="{ 'text-active': row.activePolicies > 0 }">{{ row.activePolicies }}</span>
            </template>
          </el-table-column>
          <el-table-column label="累计保费" width="100" align="right">
            <template #default="{ row }">¥{{ row.totalPremium.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="latestPolicyNo" label="最近保单" min-width="150" />
          <el-table-column prop="latestDate" label="最近投保日" width="110" />
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEmployeeDetail(row.employeeId)">
                查看保单
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="保险产品" name="products">
        <el-table :data="store.insuranceProducts" stripe border>
          <el-table-column prop="name" label="产品名称" min-width="160" />
          <el-table-column prop="code" label="产品编码" width="120" />
          <el-table-column label="类型" width="110">
            <template #default="{ row }">{{ getInsuranceProductTypeLabel(row.type) }}</template>
          </el-table-column>
          <el-table-column prop="provider" label="承保公司" width="120" />
          <el-table-column label="日保费" width="90" align="right">
            <template #default="{ row }">¥{{ row.dailyPremium.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="保额" width="90" align="right">
            <template #default="{ row }">{{ row.coverageAmount }}万</template>
          </el-table-column>
          <el-table-column label="打卡自动投保" width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="row.autoOnPunch ? 'success' : 'info'" size="small">
                {{ row.autoOnPunch ? '是' : '否' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
                {{ row.enabled ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
        </el-table>
        <p class="hint">默认方案「灵工日保·意外伤害」在 C 端上班打卡成功后自动投保，当日 23:59 失效。</p>
      </el-tab-pane>
    </el-tabs>

    <el-drawer v-model="detailVisible" title="保单详情" size="420px">
      <template v-if="selectedPolicy">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="保单号">{{ selectedPolicy.policyNo }}</el-descriptions-item>
          <el-descriptions-item label="被保人">
            {{ employeeMap[selectedPolicy.employeeId]?.name }}
            （{{ employeeMap[selectedPolicy.employeeId]?.employeeNo }}）
          </el-descriptions-item>
          <el-descriptions-item label="保险产品">
            {{ productMap[selectedPolicy.productId]?.name }}
          </el-descriptions-item>
          <el-descriptions-item label="承保公司">
            {{ productMap[selectedPolicy.productId]?.provider }}
          </el-descriptions-item>
          <el-descriptions-item label="工作日期">{{ selectedPolicy.workDate }}</el-descriptions-item>
          <el-descriptions-item label="生效时间">
            {{ formatDateTime(selectedPolicy.effectiveTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="失效时间">
            {{ formatDateTime(selectedPolicy.expireTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="保费">¥{{ selectedPolicy.premium.toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="保额">
            {{ productMap[selectedPolicy.productId]?.coverageAmount }} 万元
          </el-descriptions-item>
          <el-descriptions-item label="打卡地点">{{ selectedPolicy.location ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="关联打卡">{{ selectedPolicy.punchId ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getInsurancePolicyStatusTagType(selectedPolicy.status)" size="small">
              {{ getInsurancePolicyStatusLabel(selectedPolicy.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDateTime(selectedPolicy.createdAt) }}
          </el-descriptions-item>
        </el-descriptions>
        <div v-if="selectedPolicy.status === 'active'" class="drawer-actions">
          <el-button type="danger" plain @click="handleCancelPolicy(selectedPolicy.id)">退保</el-button>
        </div>
      </template>
    </el-drawer>

    <el-drawer
      v-model="employeeDetailVisible"
      :title="`${employeeMap[selectedEmployeeId]?.name ?? ''} · 投保记录`"
      size="520px"
    >
      <el-table :data="employeePolicies" stripe border size="small">
        <el-table-column prop="policyNo" label="保单号" min-width="140" />
        <el-table-column prop="workDate" label="日期" width="100" />
        <el-table-column label="产品" min-width="130">
          <template #default="{ row }">{{ productMap[row.productId]?.name }}</template>
        </el-table-column>
        <el-table-column label="保费" width="70" align="right">
          <template #default="{ row }">{{ row.premium.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getInsurancePolicyStatusTagType(row.status)" size="small">
              {{ getInsurancePolicyStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>
  </div>
</template>

<style scoped>
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  padding: 16px;
  border-radius: 8px;
  background: #fafafa;
  border: 1px solid var(--app-border);
}

.stat-item.active {
  background: var(--app-primary-light);
  border-color: #ffccc7;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
}

.stat-item.active .stat-value {
  color: var(--app-primary);
}

.text-active {
  color: var(--app-primary);
  font-weight: 600;
}

.hint {
  margin-top: 12px;
  font-size: 12px;
  color: #909399;
}

.drawer-actions {
  margin-top: 20px;
}
</style>
