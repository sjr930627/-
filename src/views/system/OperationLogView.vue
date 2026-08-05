<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, RefreshRight } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import {
  exportOperationLogsCsv,
  formatOperationLogOperator,
  formatOperationLogTime,
  getOperationLogTypeLabel,
  operationLogResultOptions,
  operationLogTypeOptions,
} from '@/constants/operationLog'
import { downloadTextFile } from '@/services/payroll'
import type { SystemOperationLog } from '@/types'

const store = useAppStore()
const { isPlatform, isEnterprise } = usePortal()

const dateRange = ref<[string, string] | null>(null)
const enterpriseFilter = ref<'all' | 'platform' | string>('all')
const operatorKeyword = ref('')
const typeFilter = ref<(typeof operationLogTypeOptions)[number]['value']>('all')
const resultFilter = ref<(typeof operationLogResultOptions)[number]['value']>('all')
const page = ref(1)
const pageSize = ref(10)
const detailVisible = ref(false)
const activeLog = ref<SystemOperationLog | null>(null)

const enterpriseOptions = computed(() => {
  const items = store.enterprises.map((e) => ({ value: e.id, label: e.name }))
  return [{ value: 'platform', label: '平台' }, ...items]
})

const scopedLogs = computed(() => {
  if (isEnterprise.value) {
    return store.systemOperationLogs.filter(
      (log) => log.portal === 'enterprise' && log.enterpriseId === store.currentEnterpriseId,
    )
  }
  return store.systemOperationLogs
})

const filteredLogs = computed(() =>
  scopedLogs.value
    .filter((log) => {
      if (isPlatform.value && enterpriseFilter.value !== 'all') {
        if (enterpriseFilter.value === 'platform') {
          if (log.enterpriseId) return false
        } else if (log.enterpriseId !== enterpriseFilter.value) {
          return false
        }
      }
      if (operatorKeyword.value.trim()) {
        const kw = operatorKeyword.value.trim().toLowerCase()
        const operatorLabel = formatOperationLogOperator(log.operatorName, log.operatorRoleLabel)
        if (
          !operatorLabel.toLowerCase().includes(kw) &&
          !(log.operatorUsername?.toLowerCase().includes(kw) ?? false)
        ) {
          return false
        }
      }
      if (typeFilter.value !== 'all' && log.operationType !== typeFilter.value) return false
      if (resultFilter.value !== 'all' && log.result !== resultFilter.value) return false
      if (dateRange.value) {
        const [from, to] = dateRange.value
        const day = log.operatedAt.slice(0, 10)
        if (day < from || day > to) return false
      }
      return true
    })
    .sort((a, b) => b.operatedAt.localeCompare(a.operatedAt))
    .map((log) => ({
      ...log,
      operatedAtLabel: formatOperationLogTime(log.operatedAt),
      operatorLabel: formatOperationLogOperator(log.operatorName, log.operatorRoleLabel),
      operationTypeLabel: getOperationLogTypeLabel(log.operationType),
      resultLabel: log.result === 'success' ? '成功' : '失败',
    })),
)

const pagedLogs = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredLogs.value.slice(start, start + pageSize.value)
})

const totalCount = computed(() => filteredLogs.value.length)

function resetFilters() {
  dateRange.value = null
  enterpriseFilter.value = 'all'
  operatorKeyword.value = ''
  typeFilter.value = 'all'
  resultFilter.value = 'all'
  page.value = 1
}

function search() {
  page.value = 1
}

function openDetail(row: SystemOperationLog) {
  activeLog.value = row
  detailVisible.value = true
}

function exportLogs() {
  const csv = exportOperationLogsCsv(filteredLogs.value)
  const prefix = isEnterprise.value ? 'enterprise' : 'platform'
  downloadTextFile(csv, `${prefix}_operation_logs.csv`, 'text/csv;charset=utf-8')
  ElMessage.success(`已导出 ${filteredLogs.value.length} 条操作日志`)
}
</script>

<template>
  <div class="oplog-page page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">操作日志</h2>
        <p class="text-muted">
          {{ isEnterprise ? '记录本企业端账号的关键操作与登录行为' : '记录平台运营与企业租户相关的关键操作' }}
        </p>
      </div>
    </div>

    <div class="filter-panel">
      <el-form inline class="filter-form" @submit.prevent="search">
        <el-form-item label="时间">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="~"
            start-placeholder="年/月/日"
            end-placeholder="年/月/日"
            value-format="YYYY-MM-DD"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item v-if="isPlatform" label="所属企业">
          <el-select v-model="enterpriseFilter" style="width: 180px">
            <el-option label="全部企业" value="all" />
            <el-option v-for="opt in enterpriseOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="operatorKeyword" placeholder="姓名/账号" clearable style="width: 160px" />
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="typeFilter" style="width: 140px">
            <el-option
              v-for="opt in operationLogTypeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="结果">
          <el-select v-model="resultFilter" style="width: 110px">
            <el-option
              v-for="opt in operationLogResultOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="search">搜索</el-button>
          <el-button :icon="RefreshRight" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="toolbar">
      <el-button type="primary" @click="exportLogs">导出</el-button>
    </div>

    <el-table :data="pagedLogs" border stripe empty-text="暂无操作日志">
      <el-table-column prop="operatedAtLabel" label="操作时间" width="170" />
      <el-table-column prop="enterpriseName" label="所属企业" min-width="160" show-overflow-tooltip />
      <el-table-column prop="operatorLabel" label="操作人" width="140" />
      <el-table-column prop="operationTypeLabel" label="操作类型" width="130" />
      <el-table-column prop="targetObject" label="操作对象" min-width="140" show-overflow-tooltip />
      <el-table-column prop="detail" label="操作详情" min-width="200" show-overflow-tooltip />
      <el-table-column label="结果" width="80" align="center">
        <template #default="{ row }">
          <span :class="row.result === 'success' ? 'result-success' : 'result-failed'">
            {{ row.resultLabel }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="ip" label="操作IP" width="130" />
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-footer">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="totalCount"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        background
      />
    </div>
  </div>

  <el-dialog v-model="detailVisible" title="操作日志详情" width="560px">
    <template v-if="activeLog">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="操作时间">
          {{ formatOperationLogTime(activeLog.operatedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="所属企业">{{ activeLog.enterpriseName }}</el-descriptions-item>
        <el-descriptions-item label="操作人">
          {{ formatOperationLogOperator(activeLog.operatorName, activeLog.operatorRoleLabel) }}
          <span v-if="activeLog.operatorUsername" class="text-muted">（{{ activeLog.operatorUsername }}）</span>
        </el-descriptions-item>
        <el-descriptions-item label="操作类型">
          {{ getOperationLogTypeLabel(activeLog.operationType) }}
        </el-descriptions-item>
        <el-descriptions-item label="操作对象">{{ activeLog.targetObject }}</el-descriptions-item>
        <el-descriptions-item label="操作详情">{{ activeLog.detail }}</el-descriptions-item>
        <el-descriptions-item label="结果">
          <span :class="activeLog.result === 'success' ? 'result-success' : 'result-failed'">
            {{ activeLog.result === 'success' ? '成功' : '失败' }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="操作IP">{{ activeLog.ip }}</el-descriptions-item>
        <el-descriptions-item v-if="activeLog.userAgent" label="客户端">
          {{ activeLog.userAgent }}
        </el-descriptions-item>
        <el-descriptions-item v-if="activeLog.failReason" label="失败原因">
          {{ activeLog.failReason }}
        </el-descriptions-item>
      </el-descriptions>
    </template>
    <template #footer>
      <el-button @click="detailVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.oplog-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.filter-panel {
  padding: 16px;
  margin-bottom: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 8px;
  margin-right: 12px;
}

.toolbar {
  margin-bottom: 12px;
}

.table-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.result-success {
  color: #67c23a;
  font-weight: 500;
}

.result-failed {
  color: #f56c6c;
  font-weight: 500;
}
</style>
