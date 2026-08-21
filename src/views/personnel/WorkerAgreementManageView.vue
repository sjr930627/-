<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  resolveWorkerAgreementStatus,
  workerAgreementStatusMap,
  workerAgreementTypeMap,
} from '@/constants/workerAgreement'
import type { WorkerAgreement, WorkerAgreementStatus, WorkerAgreementType } from '@/types'

const store = useAppStore()

const keyword = ref('')
const statusFilter = ref<'all' | WorkerAgreementStatus>('all')
const providerFilter = ref('all')
const page = ref(1)
const pageSize = ref(10)
const detailVisible = ref(false)
const selected = ref<WorkerAgreement | null>(null)
const createVisible = ref(false)

const createForm = reactive({
  employeeId: '',
  providerId: '',
  title: '',
  content: '',
  agreementType: 'service' as WorkerAgreementType,
  required: true,
  effectiveDate: '',
  expiryDate: '',
})

const employeeMap = computed(() => Object.fromEntries(store.employees.map((e) => [e.id, e])))
const providerMap = computed(() =>
  Object.fromEntries(store.serviceProviders.map((p) => [p.id, p])),
)

const stats = computed(() => {
  const all = store.workerAgreements.filter((a) => (a.agreementType ?? 'service') === 'service')
  let pending = 0
  let signed = 0
  let expired = 0
  let terminated = 0
  for (const a of all) {
    const s = resolveWorkerAgreementStatus(a)
    if (s === 'pending') pending += 1
    else if (s === 'signed') signed += 1
    else if (s === 'expired') expired += 1
    else if (s === 'terminated') terminated += 1
  }
  return { total: all.length, pending, signed, expired, terminated }
})

const tableData = computed(() =>
  store.workerAgreements
    .filter((a) => (a.agreementType ?? 'service') === 'service')
    .map((a) => {
      const emp = employeeMap.value[a.employeeId]
      const provider = a.providerId ? providerMap.value[a.providerId] : undefined
      const displayStatus = resolveWorkerAgreementStatus(a)
      return {
        ...a,
        employeeName: emp?.name ?? '-',
        employeeNo: emp?.employeeNo ?? '-',
        phone: emp?.phone || '-',
        providerName: provider?.name ?? (a.providerId ? '-' : '平台通用'),
        typeLabel: workerAgreementTypeMap.service,
        displayStatus,
        statusMeta: workerAgreementStatusMap[displayStatus],
      }
    })
    .filter((row) => {
      if (statusFilter.value !== 'all' && row.displayStatus !== statusFilter.value) return false
      if (providerFilter.value !== 'all' && row.providerId !== providerFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        row.employeeName.toLowerCase().includes(kw) ||
        row.phone.toLowerCase().includes(kw) ||
        row.employeeNo.toLowerCase().includes(kw) ||
        (row.contractNo ?? '').toLowerCase().includes(kw) ||
        row.title.toLowerCase().includes(kw) ||
        row.providerName.toLowerCase().includes(kw)
      )
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
)

const pagedData = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return tableData.value.slice(start, start + pageSize.value)
})

function resetFilters() {
  keyword.value = ''
  statusFilter.value = 'all'
  providerFilter.value = 'all'
  page.value = 1
}

function openDetail(row: WorkerAgreement) {
  selected.value = row
  detailVisible.value = true
}

function openCreate() {
  createForm.employeeId = ''
  createForm.providerId = store.serviceProviders[0]?.id ?? ''
  createForm.title = '灵工服务协议（标准版）'
  createForm.content = '约定灵工与服务商之间的服务关系、服务范围、结算方式及权利义务。'
  createForm.agreementType = 'service'
  createForm.required = true
  createForm.effectiveDate = new Date().toISOString().slice(0, 10)
  createForm.expiryDate = ''
  createVisible.value = true
}

function submitCreate() {
  if (!createForm.employeeId) {
    ElMessage.warning('请选择灵工人员')
    return
  }
  if (!createForm.providerId) {
    ElMessage.warning('请选择服务商')
    return
  }
  if (!createForm.title.trim()) {
    ElMessage.warning('请填写协议名称')
    return
  }
  store.createWorkerAgreement({
    employeeId: createForm.employeeId,
    providerId: createForm.providerId,
    title: createForm.title.trim(),
    content: createForm.content.trim() || createForm.title.trim(),
    agreementType: createForm.agreementType,
    required: createForm.required,
    effectiveDate: createForm.effectiveDate || undefined,
    expiryDate: createForm.expiryDate || undefined,
  })
  createVisible.value = false
  ElMessage.success('已发起协议，待灵工签署')
}

function formatDateTime(iso?: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN')
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">合同管理</h2>
        <p class="text-muted">管理灵工人员签署的灵工服务协议，支持查看合同内容</p>
      </div>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        发起协议
      </el-button>
    </div>

    <div class="stat-row">
      <div class="stat-item">
        <span class="stat-label">协议总数</span>
        <span class="stat-value">{{ stats.total }}</span>
      </div>
      <div class="stat-item warn">
        <span class="stat-label">待签署</span>
        <span class="stat-value">{{ stats.pending }}</span>
      </div>
      <div class="stat-item active">
        <span class="stat-label">已签署</span>
        <span class="stat-value">{{ stats.signed }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已过期</span>
        <span class="stat-value">{{ stats.expired }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">已终止</span>
        <span class="stat-value">{{ stats.terminated }}</span>
      </div>
    </div>

    <div class="page-toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索协议编号、人员、手机号、服务商..."
        clearable
        style="width: 280px"
        prefix-icon="Search"
        @change="page = 1"
      />
      <el-select v-model="providerFilter" placeholder="服务商" style="width: 200px" @change="page = 1">
        <el-option label="全部服务商" value="all" />
        <el-option
          v-for="p in store.serviceProviders"
          :key="p.id"
          :label="p.shortName || p.name"
          :value="p.id"
        />
      </el-select>
      <el-radio-group v-model="statusFilter" @change="page = 1">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="pending">待签署</el-radio-button>
        <el-radio-button value="signed">已签署</el-radio-button>
        <el-radio-button value="expired">已过期</el-radio-button>
        <el-radio-button value="terminated">已终止</el-radio-button>
      </el-radio-group>
      <el-button text @click="resetFilters">
        <el-icon><RefreshLeft /></el-icon>
        重置
      </el-button>
    </div>

    <el-table :data="pagedData" stripe border>
      <el-table-column prop="contractNo" label="协议编号" width="140">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">{{ row.contractNo || '-' }}</el-button>
        </template>
      </el-table-column>
      <el-table-column label="灵工人员" min-width="120">
        <template #default="{ row }">
          <div>{{ row.employeeName }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column prop="providerName" label="服务商" min-width="180" show-overflow-tooltip />
      <el-table-column prop="title" label="协议名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="typeLabel" label="类型" width="130" />
      <el-table-column label="生效日期" width="120">
        <template #default="{ row }">{{ row.effectiveDate || '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.statusMeta.tag" size="small">{{ row.statusMeta.label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="签署时间" width="160">
        <template #default="{ row }">{{ formatDateTime(row.signedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">查看合同</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-footer">
      <span class="text-muted">共 {{ tableData.length }} 条</span>
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="tableData.length"
        layout="prev, pager, next"
        background
      />
    </div>

    <el-drawer v-model="detailVisible" title="查看合同" size="460px">
      <template v-if="selected">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="协议编号">{{ selected.contractNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="协议名称">{{ selected.title }}</el-descriptions-item>
          <el-descriptions-item label="协议类型">灵工服务协议</el-descriptions-item>
          <el-descriptions-item label="灵工人员">
            {{ employeeMap[selected.employeeId]?.name ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="手机号">
            {{ employeeMap[selected.employeeId]?.phone || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="服务商">
            {{
              selected.providerId
                ? providerMap[selected.providerId]?.name ?? '-'
                : '平台通用'
            }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag
              :type="workerAgreementStatusMap[resolveWorkerAgreementStatus(selected)].tag"
              size="small"
            >
              {{ workerAgreementStatusMap[resolveWorkerAgreementStatus(selected)].label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="是否必签">{{ selected.required ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="生效日期">{{ selected.effectiveDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="签署时间">{{ formatDateTime(selected.signedAt) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDateTime(selected.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="协议内容">{{ selected.content }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>

    <el-dialog v-model="createVisible" title="发起灵工协议" width="520px" destroy-on-close>
      <el-form label-width="96px">
        <el-form-item label="灵工人员" required>
          <el-select v-model="createForm.employeeId" filterable placeholder="选择人员" style="width: 100%">
            <el-option
              v-for="e in store.activeEmployees"
              :key="e.id"
              :label="`${e.name}（${e.employeeNo}）`"
              :value="e.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="服务商" required>
          <el-select v-model="createForm.providerId" filterable placeholder="选择服务商" style="width: 100%">
            <el-option
              v-for="p in store.serviceProviders"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="协议类型" required>
          <el-select v-model="createForm.agreementType" style="width: 100%" disabled>
            <el-option label="灵工服务协议" value="service" />
          </el-select>
        </el-form-item>
        <el-form-item label="协议名称" required>
          <el-input v-model="createForm.title" placeholder="协议名称" />
        </el-form-item>
        <el-form-item label="协议内容">
          <el-input v-model="createForm.content" type="textarea" :rows="3" placeholder="协议摘要" />
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker
            v-model="createForm.effectiveDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="是否必签">
          <el-switch v-model="createForm.required" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">确认发起</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  background: #f7f8fa;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-item.active {
  background: #ecf9f0;
}

.stat-item.warn {
  background: #fff7e8;
}

.stat-label {
  font-size: 12px;
  color: #909399;
}

.stat-value {
  font-size: 22px;
  font-weight: 650;
  color: #303133;
}

.page-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}

.sub {
  font-size: 12px;
  color: #909399;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
}

.drawer-actions {
  margin-top: 20px;
}

@media (max-width: 1100px) {
  .stat-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
