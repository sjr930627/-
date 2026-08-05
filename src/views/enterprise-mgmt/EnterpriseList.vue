<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  enterpriseStatusMap,
  formatEnterpriseModules,
  formatEnterpriseOwnerNames,
  getEnterpriseOwnerIds,
} from '@/constants/enterprise'
import type { Enterprise } from '@/types'

const store = useAppStore()
const router = useRouter()

const keywordCode = ref('')
const keywordName = ref('')
const ownerFilter = ref('')
const dateRange = ref<[string, string] | null>(null)
const statusFilter = ref<'all' | 'cooperating' | 'terminated'>('all')
const page = ref(1)
const pageSize = ref(8)
const selectedIds = ref<string[]>([])

const avatarColors = ['#5b4fdb', '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']

function avatarColor(name: string) {
  return avatarColors[name.charCodeAt(0) % avatarColors.length]
}

const filteredData = computed(() =>
  store.enterprises
    .filter((e) => {
      if (statusFilter.value === 'cooperating' && e.status === 'terminated') return false
      if (statusFilter.value === 'terminated' && e.status !== 'terminated') return false
      if (keywordCode.value.trim() && !e.code.includes(keywordCode.value.trim())) return false
      if (keywordName.value.trim()) {
        const kw = keywordName.value.trim()
        if (!e.name.includes(kw) && !e.shortName.includes(kw)) return false
      }
      if (ownerFilter.value.trim()) {
        const kw = ownerFilter.value.trim()
        const ownerLabel = formatEnterpriseOwnerNames(
          getEnterpriseOwnerIds(e),
          store.systemAccounts,
        )
        if (!ownerLabel.includes(kw)) return false
      }
      if (dateRange.value) {
        const [from, to] = dateRange.value
        if (e.createdAt < from || e.createdAt > to) return false
      }
      return true
    })
    .map((e) => ({
      ...e,
      modulesLabel: formatEnterpriseModules(e.serviceModules),
      ownersLabel: formatEnterpriseOwnerNames(getEnterpriseOwnerIds(e), store.systemAccounts),
      statusMeta: enterpriseStatusMap[e.status],
    })),
)

const pagedData = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredData.value.slice(start, start + pageSize.value)
})

const totalCount = computed(() => filteredData.value.length)

function resetFilters() {
  keywordCode.value = ''
  keywordName.value = ''
  ownerFilter.value = ''
  dateRange.value = null
  statusFilter.value = 'all'
  page.value = 1
}

function handleSelection(rows: Enterprise[]) {
  selectedIds.value = rows.map((r) => r.id)
}

function openCreate() {
  router.push('/enterprises/create')
}

function openDetail(row: Enterprise) {
  router.push(`/enterprises/${row.id}`)
}

function openEdit(row: Enterprise) {
  router.push(`/enterprises/${row.id}/edit`)
}

async function terminate(row: Enterprise) {
  try {
    await ElMessageBox.confirm(`确定终止与「${row.name}」的合作？`, '终止合作', { type: 'warning' })
    store.terminateEnterprise(row.id)
    ElMessage.success('已终止合作')
  } catch {
    // cancelled
  }
}

function batchImport() {
  ElMessage.info('批量导入功能 Demo 暂未接入')
}

function batchExport() {
  ElMessage.success(`已导出 ${selectedIds.value.length || totalCount.value} 条企业数据（Demo）`)
}
</script>

<template>
  <div class="enterprise-list-page">
    <div class="page-header-row">
      <div class="header-actions">
        <el-button @click="batchImport">
          <el-icon><Upload /></el-icon>
          批量导入
        </el-button>
        <el-button @click="batchExport">
          <el-icon><Download /></el-icon>
          批量导出
        </el-button>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>
          新增企业
        </el-button>
      </div>
    </div>

    <div class="page-card filter-card">
      <div class="filter-grid">
        <el-input v-model="keywordCode" placeholder="搜索企业编号" clearable prefix-icon="Search" />
        <el-input v-model="keywordName" placeholder="搜索企业名称/企业简称" clearable prefix-icon="Search" />
        <el-input v-model="ownerFilter" placeholder="搜索企业负责人" clearable />
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="创建日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
        <div class="filter-actions">
          <el-button type="primary" @click="page = 1">查询</el-button>
          <el-button text @click="resetFilters">
            <el-icon><RefreshLeft /></el-icon>
            重置筛选
          </el-button>
        </div>
      </div>

      <el-radio-group v-model="statusFilter" class="status-tabs" @change="page = 1">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="cooperating">合作中</el-radio-button>
        <el-radio-button value="terminated">已终止</el-radio-button>
      </el-radio-group>
    </div>

    <div class="page-card table-card">
      <div class="table-toolbar">
        <div class="table-title">
          企业列表
          <el-tag size="small" round>{{ store.enterprises.length }}</el-tag>
        </div>
        <span class="selection-tip">已选择 {{ selectedIds.length }} 项</span>
      </div>

      <el-table :data="pagedData" border stripe @selection-change="handleSelection">
        <el-table-column type="selection" width="48" />
        <el-table-column prop="code" label="企业编号" width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">{{ row.code }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="企业名称" min-width="200">
          <template #default="{ row }">
            <div class="name-cell">
              <span class="name-avatar" :style="{ background: avatarColor(row.name) }">
                {{ row.name.charAt(0) }}
              </span>
              <span>{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="shortName" label="企业简称" width="120" />
        <el-table-column prop="ownersLabel" label="企业负责人" min-width="140" show-overflow-tooltip />
        <el-table-column label="企业联系人" width="110">
          <template #default="{ row }">
            <span class="contact-person">{{ row.contactPerson }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="modulesLabel" label="服务模块" min-width="180" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="创建日期" width="120" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <span class="status-dot" :style="{ background: row.statusMeta.dot }" />
            {{ row.statusMeta.label }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">查看</el-button>
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button
              v-if="row.status !== 'terminated'"
              link
              type="danger"
              @click="terminate(row)"
            >
              终止
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <span class="text-muted">
          显示 {{ totalCount ? (page - 1) * pageSize + 1 : 0 }}-{{
            Math.min(page * pageSize, totalCount)
          }}
          条，共 {{ totalCount }} 条记录
        </span>
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="totalCount"
          layout="prev, pager, next"
          background
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.enterprise-list-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-header-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.filter-card {
  padding: 16px 20px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr)) auto;
  gap: 12px;
  align-items: center;
}

.filter-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.status-tabs {
  margin-top: 14px;
}

.table-card {
  padding: 0 0 12px;
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
}

.table-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.selection-tip {
  font-size: 13px;
  color: #909399;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.name-avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.contact-person {
  color: #606266;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px 0;
}

@media (max-width: 1200px) {
  .filter-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
