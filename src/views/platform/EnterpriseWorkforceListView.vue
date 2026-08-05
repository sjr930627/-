<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { enterpriseStatusMap } from '@/constants/enterprise'

const store = useAppStore()
const router = useRouter()

const keyword = ref('')
const statusFilter = ref<'all' | 'active' | 'expiring' | 'terminated'>('all')
const page = ref(1)
const pageSize = ref(10)

const avatarColors = ['#2563eb', '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']

function avatarColor(name: string) {
  return avatarColors[name.charCodeAt(0) % avatarColors.length]
}

const tableData = computed(() =>
  store.enterprises
    .map((ent) => {
      const stats = store.getEnterpriseWorkforceStats(ent.id)
      return {
        ...ent,
        ...stats,
        statusMeta: enterpriseStatusMap[ent.status],
        totalHeadcount: stats.activeCount + stats.pendingCount,
      }
    })
    .filter((row) => {
      if (statusFilter.value !== 'all' && row.status !== statusFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        row.code.toLowerCase().includes(kw) ||
        row.name.toLowerCase().includes(kw) ||
        row.shortName.toLowerCase().includes(kw)
      )
    })
    .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name, 'zh-CN')),
)

const pagedData = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return tableData.value.slice(start, start + pageSize.value)
})

const totalCount = computed(() => tableData.value.length)

const summary = computed(() => ({
  enterprises: store.enterprises.length,
  departments: tableData.value.reduce((sum, row) => sum + row.departmentCount, 0),
  activeEmployees: tableData.value.reduce((sum, row) => sum + row.activeCount, 0),
}))

function resetFilters() {
  keyword.value = ''
  statusFilter.value = 'all'
  page.value = 1
}

function openOrg(row: { id: string }) {
  router.push(`/employees/org/${row.id}`)
}

onMounted(() => {
  store.ensureAllEnterpriseOrgStructures()
})
</script>

<template>
  <div class="workforce-overview-page">
    <div class="summary-row">
      <div class="summary-card page-card">
        <div class="summary-value">{{ summary.enterprises }}</div>
        <div class="summary-label">合作企业</div>
      </div>
      <div class="summary-card page-card">
        <div class="summary-value">{{ summary.departments }}</div>
        <div class="summary-label">部门总数</div>
      </div>
      <div class="summary-card page-card">
        <div class="summary-value">{{ summary.activeEmployees.toLocaleString() }}</div>
        <div class="summary-label">在职人员</div>
      </div>
    </div>

    <div class="page-card filter-card">
      <div class="filter-row">
        <el-input
          v-model="keyword"
          placeholder="搜索企业编号、企业名称..."
          clearable
          prefix-icon="Search"
          class="search-input"
        />
        <el-button text @click="resetFilters">
          <el-icon><RefreshLeft /></el-icon>
          重置筛选
        </el-button>
      </div>

      <el-radio-group v-model="statusFilter" class="status-tabs" @change="page = 1">
        <el-radio-button value="all">全部企业</el-radio-button>
        <el-radio-button value="active">合作中</el-radio-button>
        <el-radio-button value="expiring">即将到期</el-radio-button>
        <el-radio-button value="terminated">已终止</el-radio-button>
      </el-radio-group>
    </div>

    <div class="page-card table-card">
      <div class="table-toolbar">
        <div class="table-title">
          企业人员统计
          <el-tag size="small" round>{{ totalCount }}</el-tag>
        </div>
      </div>

      <el-table :data="pagedData" border stripe>
        <el-table-column prop="code" label="企业编号" width="140" />
        <el-table-column label="企业名称" min-width="220">
          <template #default="{ row }">
            <div class="name-cell">
              <span class="name-avatar" :style="{ background: avatarColor(row.name) }">
                {{ row.shortName.charAt(0) }}
              </span>
              <div>
                <div>{{ row.name }}</div>
                <div class="text-muted">{{ row.shortName }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="departmentCount" label="部门数" width="90" align="center" />
        <el-table-column prop="activeCount" label="在职人员" width="100" align="center">
          <template #default="{ row }">
            <span class="count-strong">{{ row.activeCount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="pendingCount" label="待入职" width="90" align="center" />
        <el-table-column prop="resignedCount" label="已离职" width="90" align="center" />
        <el-table-column prop="teamCount" label="班组数" width="90" align="center" />
        <el-table-column label="合作状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.statusMeta.type">{{ row.statusMeta.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openOrg(row)">查看详情</el-button>
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
.workforce-overview-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.summary-card {
  padding: 18px 20px;
  text-align: center;
}

.summary-value {
  font-size: 28px;
  font-weight: 700;
  color: #2563eb;
  line-height: 1.2;
}

.summary-label {
  margin-top: 6px;
  font-size: 13px;
  color: #909399;
}

.filter-card {
  padding: 16px 20px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.search-input {
  flex: 1;
  min-width: 280px;
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

.count-strong {
  font-weight: 600;
  color: #2563eb;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px 0;
}

@media (max-width: 900px) {
  .summary-row {
    grid-template-columns: 1fr;
  }
}
</style>
