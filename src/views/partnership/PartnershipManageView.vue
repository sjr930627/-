<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import {
  contractStatusMap,
  formatContractExpiry,
  providerStatusMap,
  resolveContractDisplayStatus,
} from '@/constants/partnership'
import { getContractBillingListItems } from '@/services/contractBilling'

const store = useAppStore()
const router = useRouter()
const { pathPrefix } = usePortal()

const keyword = ref('')
const statusFilter = ref<'all' | 'cooperating' | 'suspended' | 'terminated'>('all')
const selectedProviderId = ref('sp_zhongqin')

const providerList = computed(() =>
  store.serviceProviders
    .filter((p) => {
      if (statusFilter.value !== 'all' && p.status !== statusFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        p.name.toLowerCase().includes(kw) ||
        p.code.toLowerCase().includes(kw) ||
        (p.shortName ?? '').toLowerCase().includes(kw)
      )
    })
    .map((p) => {
      const contracts = store
        .getContractsByProvider(p.id)
        .filter((c) => !store.currentEnterpriseId || c.enterpriseId === store.currentEnterpriseId)
      const activeContracts = contracts.filter(
        (c) => resolveContractDisplayStatus(c) === 'active',
      )
      return {
        ...p,
        statusLabel: providerStatusMap[p.status].label,
        statusType: providerStatusMap[p.status].type,
        contractCount: contracts.length,
        activeContractCount: activeContracts.length,
      }
    }),
)

const selectedProvider = computed(() =>
  providerList.value.find((p) => p.id === selectedProviderId.value),
)

const contractList = computed(() => {
  if (!selectedProviderId.value) return []
  return store
    .getContractsByProvider(selectedProviderId.value)
    .filter((c) => !store.currentEnterpriseId || c.enterpriseId === store.currentEnterpriseId)
    .map((c) => {
      const displayStatus = resolveContractDisplayStatus(c)
      return {
        ...c,
        displayStatus,
        statusMeta: contractStatusMap[displayStatus],
        billingItems: getContractBillingListItems(c),
        expiryLabel: formatContractExpiry(c.expiryDate, c.contractTerm),
        versionLabel: c.currentVersion ? `V${c.currentVersion}` : '—',
        versionCount: c.versions?.length ?? 0,
      }
    })
    .filter((c) => c.displayStatus === 'active')
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
})

const summary = computed(() => ({
  total: store.serviceProviders.length,
  cooperating: store.serviceProviders.filter((p) => p.status === 'cooperating').length,
}))

function selectProvider(id: string) {
  selectedProviderId.value = id
}

function openContractDetail(row: { id: string }) {
  router.push({
    path: `${pathPrefix.value}/contracts/${row.id}`,
    query: { from: 'partnership' },
  })
}
</script>

<template>
  <div class="partnership-page">
    <aside class="provider-panel page-card">
      <div class="panel-header">
        <span class="panel-title">关联服务商</span>
      </div>
      <p class="text-muted panel-tip">共 {{ summary.total }} 家 · 合作中 {{ summary.cooperating }} 家</p>

      <el-input
        v-model="keyword"
        placeholder="搜索服务商"
        clearable
        prefix-icon="Search"
        class="panel-search"
      />
      <el-radio-group v-model="statusFilter" size="small" class="status-filter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="cooperating">合作中</el-radio-button>
        <el-radio-button value="suspended">已暂停</el-radio-button>
      </el-radio-group>

      <div
        v-for="provider in providerList"
        :key="provider.id"
        class="provider-item"
        :class="{ active: selectedProviderId === provider.id }"
        @click="selectProvider(provider.id)"
      >
        <div class="provider-item-head">
          <span class="provider-name">{{ provider.shortName ?? provider.name }}</span>
          <el-tag size="small" :type="provider.statusType">{{ provider.statusLabel }}</el-tag>
        </div>
        <div class="provider-meta">{{ provider.code }}</div>
        <div class="provider-meta">
          生效合同 {{ provider.activeContractCount }}/{{ provider.contractCount }}
        </div>
      </div>
      <el-empty v-if="!providerList.length" description="无匹配服务商" :image-size="60" />
    </aside>

    <section v-if="selectedProvider" class="detail-panel">
      <div class="page-card provider-summary">
        <div class="summary-header">
          <div>
            <h2 class="page-title">{{ selectedProvider.name }}</h2>
            <p class="text-muted">合作自 {{ selectedProvider.cooperationStartDate }}</p>
          </div>
          <el-tag :type="selectedProvider.statusType">{{ selectedProvider.statusLabel }}</el-tag>
        </div>

        <el-descriptions :column="3" border>
          <el-descriptions-item label="服务商编码">{{ selectedProvider.code }}</el-descriptions-item>
          <el-descriptions-item label="合作起始日">
            {{ selectedProvider.cooperationStartDate || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag size="small" :type="selectedProvider.statusType">
              {{ selectedProvider.statusLabel }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="selectedProvider.remark" label="备注" :span="3">
            {{ selectedProvider.remark }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="page-card contract-card">
        <div class="page-header">
          <div>
            <h3 class="section-title">合作合同</h3>
            <p class="text-muted">仅展示生效中的合同，服务费配置与后台合同管理一致</p>
          </div>
        </div>

        <el-table :data="contractList" border stripe empty-text="暂无生效中合同">
          <el-table-column prop="contractNo" label="合同编号" width="150">
            <template #default="{ row }">
              <el-button link type="primary" @click="openContractDetail(row)">
                {{ row.contractNo }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="合同名称" min-width="180" show-overflow-tooltip />
          <el-table-column label="服务费配置" min-width="240">
            <template #default="{ row }">
              <div v-if="row.billingItems.length" class="billing-config-cell">
                <div
                  v-for="item in row.billingItems"
                  :key="item.type"
                  class="billing-config-row"
                >
                  <el-tag
                    size="small"
                    :type="item.type === 'hourly' ? 'primary' : 'success'"
                    class="billing-type-tag"
                  >
                    {{ item.typeLabel }}
                  </el-tag>
                  <span class="billing-rate">{{ item.rateLabel }}</span>
                </div>
              </div>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="合同期限" min-width="200">
            <template #default="{ row }">
              {{ row.effectiveDate }} ~ {{ row.expiryLabel }}
            </template>
          </el-table-column>
          <el-table-column label="生效版本" width="100">
            <template #default="{ row }">
              <el-tag size="small" type="success">{{ row.versionLabel }}</el-tag>
              <span v-if="row.versionCount > 1" class="ver-count">/{{ row.versionCount }}版</span>
            </template>
          </el-table-column>
          <el-table-column label="合同状态" width="100">
            <template #default="{ row }">
              <span class="status-dot" :style="{ background: row.statusMeta.dot }" />
              {{ row.statusMeta.label }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openContractDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <el-empty v-else description="请选择服务商" class="page-card empty-panel" />
  </div>
</template>

<style scoped>
.partnership-page {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
  align-items: start;
}

.provider-panel {
  padding: 16px;
  position: sticky;
  top: 0;
}

.panel-header {
  margin-bottom: 4px;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
  color: #1a1a2e;
}

.panel-tip {
  margin: 0 0 12px;
  font-size: 12px;
}

.panel-search {
  margin-bottom: 10px;
}

.status-filter {
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
}

.provider-item {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  margin-bottom: 8px;
  transition: all 0.15s;
}

.provider-item:hover {
  background: #f5f3ff;
}

.provider-item.active {
  background: #ede9fe;
  border-color: #c4b5fd;
}

.provider-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.provider-name {
  font-weight: 600;
  font-size: 14px;
}

.provider-meta {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.detail-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.summary-header .page-title {
  margin-bottom: 4px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.contract-card .page-header {
  margin-bottom: 12px;
}

.billing-config-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.billing-config-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.billing-type-tag {
  flex-shrink: 0;
}

.billing-rate {
  font-size: 13px;
  color: #303133;
}

.ver-count {
  margin-left: 4px;
  font-size: 12px;
  color: #909399;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.empty-panel {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1100px) {
  .partnership-page {
    grid-template-columns: 1fr;
  }

  .provider-panel {
    position: static;
  }
}
</style>
