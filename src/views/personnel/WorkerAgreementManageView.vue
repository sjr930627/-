<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  buildWorkerAgreementPdfBlob,
  resolveWorkerAgreementStatus,
  workerAgreementStatusMap,
  workerAgreementTypeMap,
  type WorkerAgreementDisplayStatus,
} from '@/constants/workerAgreement'
import type { WorkerAgreement } from '@/types'

type RemindChannel = 'sms' | 'service_account' | 'message'

const REMIND_CHANNEL_OPTIONS: { value: RemindChannel; label: string }[] = [
  { value: 'sms', label: '短信' },
  { value: 'service_account', label: '服务号' },
  { value: 'message', label: '消息通知' },
]

const store = useAppStore()

const keyword = ref('')
const statusFilter = ref<'all' | WorkerAgreementDisplayStatus>('all')
const providerFilter = ref('all')
const page = ref(1)
const pageSize = ref(10)
const detailVisible = ref(false)
const selected = ref<WorkerAgreement | null>(null)
const pdfVisible = ref(false)
const pdfUrl = ref('')
const pdfTitle = ref('PDF合同')

const remindVisible = ref(false)
const remindTarget = ref<(WorkerAgreement & { employeeName?: string; phone?: string }) | null>(null)
const remindChannels = ref<RemindChannel[]>(['sms', 'message'])

const employeeMap = computed(() => Object.fromEntries(store.employees.map((e) => [e.id, e])))
const providerMap = computed(() =>
  Object.fromEntries(store.serviceProviders.map((p) => [p.id, p])),
)

const stats = computed(() => {
  const all = store.workerAgreements.filter((a) => (a.agreementType ?? 'service') === 'service')
  let pending = 0
  let signed = 0
  for (const a of all) {
    const s = resolveWorkerAgreementStatus(a)
    if (s === 'pending') pending += 1
    else signed += 1
  }
  return { total: all.length, pending, signed }
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

function revokePdfUrl() {
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
    pdfUrl.value = ''
  }
}

function openRemind(row: WorkerAgreement & { employeeName?: string; phone?: string }) {
  remindTarget.value = row
  remindChannels.value = ['sms', 'message']
  remindVisible.value = true
}

function submitRemind() {
  if (!remindChannels.value.length) {
    ElMessage.warning('请至少选择一种通知方式')
    return
  }
  const row = remindTarget.value
  if (!row) return
  const name = row.employeeName || employeeMap.value[row.employeeId]?.name || '该灵工'
  const channelLabel = REMIND_CHANNEL_OPTIONS.filter((o) => remindChannels.value.includes(o.value))
    .map((o) => o.label)
    .join('、')
  remindVisible.value = false
  ElMessage.success(`已通过${channelLabel}提醒 ${name} 签署「${row.title}」`)
  remindTarget.value = null
}

async function removePending(row: WorkerAgreement & { employeeName?: string; contractNo?: string }) {
  try {
    await ElMessageBox.confirm(
      `确定删除待签署协议「${row.contractNo || row.title}」吗？`,
      '删除协议',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    store.deleteWorkerAgreement(row.id)
    ElMessage.success('已删除')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}

function openDetail(row: WorkerAgreement & { displayStatus?: WorkerAgreementDisplayStatus }) {
  selected.value = row
  const status = row.displayStatus ?? resolveWorkerAgreementStatus(row)
  if (status === 'signed') {
    openPdf(row)
    return
  }
  detailVisible.value = true
}

function openPdf(row: WorkerAgreement) {
  const emp = employeeMap.value[row.employeeId]
  const provider = row.providerId ? providerMap.value[row.providerId] : undefined
  revokePdfUrl()
  const blob = buildWorkerAgreementPdfBlob(row, {
    employeeName: emp?.name ?? '-',
    phone: emp?.phone || '-',
    providerName: provider?.name ?? (row.providerId ? '-' : '平台通用'),
  })
  pdfUrl.value = URL.createObjectURL(blob)
  pdfTitle.value = `${row.contractNo || '合同'} · PDF`
  selected.value = row
  pdfVisible.value = true
}

function closePdf() {
  pdfVisible.value = false
  revokePdfUrl()
}

function formatDateTime(iso?: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN')
}

onBeforeUnmount(revokePdfUrl)
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">合同管理</h2>
        <p class="text-muted">管理灵工人员签署的灵工服务协议，已签署可查看 PDF 合同</p>
      </div>
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
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.statusMeta.tag" size="small">{{ row.statusMeta.label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="签署时间" width="160">
        <template #default="{ row }">{{ formatDateTime(row.signedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.displayStatus === 'signed'"
            link
            type="primary"
            @click="openDetail(row)"
          >
            查看PDF
          </el-button>
          <template v-else>
            <el-button link type="primary" @click="openRemind(row)">提醒签署</el-button>
            <el-button link type="danger" @click="removePending(row)">删除</el-button>
          </template>
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

    <el-dialog
      :model-value="pdfVisible"
      :title="pdfTitle"
      width="860px"
      top="4vh"
      destroy-on-close
      class="pdf-dialog"
      @update:model-value="(v: boolean) => (v ? (pdfVisible = true) : closePdf())"
    >
      <div v-if="selected" class="pdf-meta">
        <span>{{ selected.title }}</span>
        <span>{{ employeeMap[selected.employeeId]?.name ?? '-' }}</span>
        <a v-if="pdfUrl" :href="pdfUrl" :download="`${selected.contractNo || 'agreement'}.pdf`">
          下载 PDF
        </a>
      </div>
      <iframe v-if="pdfUrl" :src="pdfUrl" class="pdf-frame" title="PDF合同" />
    </el-dialog>

    <el-dialog v-model="remindVisible" title="提醒签署" width="440px" destroy-on-close>
      <template v-if="remindTarget">
        <p class="remind-tip">
          向 <strong>{{ remindTarget.employeeName || employeeMap[remindTarget.employeeId]?.name || '灵工' }}</strong>
          发送「{{ remindTarget.title }}」签署提醒
        </p>
        <el-form label-position="top">
          <el-form-item label="通知方式" required>
            <el-checkbox-group v-model="remindChannels">
              <el-checkbox
                v-for="opt in REMIND_CHANNEL_OPTIONS"
                :key="opt.value"
                :label="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="remindVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRemind">发送提醒</el-button>
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

.remind-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
}

.pdf-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
  font-size: 13px;
  color: #606266;
}

.pdf-meta a {
  margin-left: auto;
  color: var(--el-color-primary);
  text-decoration: none;
}

.pdf-frame {
  width: 100%;
  height: 72vh;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f5f5f5;
}

@media (max-width: 1100px) {
  .stat-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
