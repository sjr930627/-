<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { providerStatusMap, esignPlatformMap } from '@/constants/partnership'
import type { ServiceProvider, ServiceProviderStatus } from '@/types'

const store = useAppStore()
const router = useRouter()

const keyword = ref('')
const contactFilter = ref('')
const statusFilter = ref<'all' | ServiceProviderStatus>('all')
const page = ref(1)
const pageSize = ref(8)
const selectedIds = ref<string[]>([])

const avatarColors = ['#2563eb', '#409eff', '#67c23a', '#e6a23c', '#f56c6c']

function avatarColor(name: string) {
  return avatarColors[name.charCodeAt(0) % avatarColors.length]
}

const tableData = computed(() =>
  store.serviceProviders
    .map((p) => ({
      ...p,
      statusMeta: providerStatusMap[p.status],
      enterpriseCount: p.linkedEnterpriseIds.length,
      contractCount: store.getContractsByProvider(p.id).length,
      activeContractCount: store.getContractsByProvider(p.id).filter((c) => c.status === 'active').length,
      signTemplateCount: p.signContractTemplates?.length ?? 0,
      requiredSignCount: p.signContractTemplates?.filter((t) => t.required).length ?? 0,
      esignPlatformLabel: p.esignPlatform ? esignPlatformMap[p.esignPlatform] : '-',
    }))
    .filter((row) => {
      if (statusFilter.value !== 'all' && row.status !== statusFilter.value) return false
      if (contactFilter.value.trim()) {
        const kw = contactFilter.value.trim()
        if (!row.contact.includes(kw) && !row.phone.includes(kw)) return false
      }
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        row.code.toLowerCase().includes(kw) ||
        row.name.toLowerCase().includes(kw) ||
        (row.shortName?.toLowerCase().includes(kw) ?? false) ||
        row.businessScope.toLowerCase().includes(kw)
      )
    })
    .sort((a, b) => b.cooperationStartDate.localeCompare(a.cooperationStartDate)),
)

const pagedData = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return tableData.value.slice(start, start + pageSize.value)
})

const totalCount = computed(() => tableData.value.length)

function resetFilters() {
  keyword.value = ''
  contactFilter.value = ''
  statusFilter.value = 'all'
  page.value = 1
}

function handleSelection(rows: ServiceProvider[]) {
  selectedIds.value = rows.map((r) => r.id)
}

function openCreate() {
  router.push('/service-providers/create')
}

function openDetail(row: ServiceProvider) {
  router.push(`/service-providers/${row.id}`)
}

function openEdit(row: ServiceProvider) {
  router.push(`/service-providers/${row.id}/edit`)
}

async function updateStatus(row: ServiceProvider, status: ServiceProviderStatus, label: string) {
  try {
    await ElMessageBox.confirm(`确定将「${row.name}」标记为${label}？`, '变更状态', { type: 'warning' })
    store.updateServiceProviderStatus(row.id, status)
    ElMessage.success(`已更新为${label}`)
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="provider-list-page">
    <div class="page-header-row">
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新增服务商
      </el-button>
    </div>

    <div class="page-card filter-card">
      <div class="filter-row">
        <el-input
          v-model="keyword"
          placeholder="搜索服务商编号、名称、业务范围..."
          clearable
          prefix-icon="Search"
          class="search-input"
        />
        <el-input v-model="contactFilter" placeholder="联系人/电话" clearable style="width: 180px" />
        <el-button text @click="resetFilters">
          <el-icon><RefreshLeft /></el-icon>
          重置筛选
        </el-button>
      </div>

      <el-radio-group v-model="statusFilter" class="status-tabs" @change="page = 1">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="cooperating">合作中</el-radio-button>
        <el-radio-button value="suspended">已暂停</el-radio-button>
        <el-radio-button value="terminated">已终止</el-radio-button>
      </el-radio-group>
    </div>

    <div class="page-card table-card">
      <div class="table-toolbar">
        <div class="table-title">
          服务商列表
          <el-tag size="small" round>{{ store.serviceProviders.length }}</el-tag>
        </div>
        <span class="selection-tip">已选择 {{ selectedIds.length }} 项</span>
      </div>

      <el-table :data="pagedData" border stripe @selection-change="handleSelection">
        <el-table-column type="selection" width="48" />
        <el-table-column prop="code" label="服务商编号" width="130">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">{{ row.code }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="服务商名称" min-width="200">
          <template #default="{ row }">
            <div class="name-cell">
              <span class="name-avatar" :style="{ background: avatarColor(row.name) }">
                {{ (row.shortName ?? row.name).charAt(0) }}
              </span>
              <div>
                <div>{{ row.name }}</div>
                <div v-if="row.shortName" class="text-muted">{{ row.shortName }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="contact" label="联系人" width="100" />
        <el-table-column prop="phone" label="联系电话" width="130" />
        <el-table-column prop="businessScope" label="业务范围" min-width="180" show-overflow-tooltip />
        <el-table-column label="关联企业" width="90" align="center">
          <template #default="{ row }">{{ row.enterpriseCount }}</template>
        </el-table-column>
        <el-table-column label="生效合约" width="90" align="center">
          <template #default="{ row }">{{ row.activeContractCount }}</template>
        </el-table-column>
        <el-table-column label="签署模板" width="100" align="center">
          <template #default="{ row }">
            <span>{{ row.signTemplateCount }}</span>
            <span v-if="row.requiredSignCount" class="text-muted"> / {{ row.requiredSignCount }}必签</span>
          </template>
        </el-table-column>
        <el-table-column label="电子签平台" width="110">
          <template #default="{ row }">{{ row.esignPlatformLabel }}</template>
        </el-table-column>
        <el-table-column prop="cooperationStartDate" label="合作开始" width="110" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.statusMeta.type">{{ row.statusMeta.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">查看</el-button>
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button
              v-if="row.status === 'cooperating'"
              link
              type="warning"
              @click="updateStatus(row, 'suspended', '已暂停')"
            >
              暂停
            </el-button>
            <el-button
              v-if="row.status !== 'terminated'"
              link
              type="danger"
              @click="updateStatus(row, 'terminated', '已终止')"
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
.provider-list-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-header-row {
  display: flex;
  justify-content: flex-end;
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

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px 0;
}
</style>
