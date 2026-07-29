<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  contractStatusMap,
  formatRate,
  formatTierRange,
  providerStatusMap,
  serviceFeeTypeMap,
  settlementCycleMap,
} from '@/constants/partnership'
import type { ServiceContract } from '@/types'

const store = useAppStore()

const keyword = ref('')
const statusFilter = ref<'all' | 'cooperating' | 'suspended' | 'terminated'>('all')
const selectedProviderId = ref('sp_zhongqin')
const contractDrawer = ref(false)
const viewingContract = ref<ServiceContract | null>(null)

const providerList = computed(() =>
  store.serviceProviders
    .filter((p) => {
      if (statusFilter.value !== 'all' && p.status !== statusFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        p.name.includes(kw) ||
        p.code.toLowerCase().includes(kw) ||
        p.contact.includes(kw) ||
        p.businessScope.includes(kw)
      )
    })
    .map((p) => ({
      ...p,
      statusLabel: providerStatusMap[p.status].label,
      statusType: providerStatusMap[p.status].type,
      contractCount: store.getContractsByProvider(p.id).length,
      activeContractCount: store.getContractsByProvider(p.id).filter((c) => c.status === 'active')
        .length,
      linkedEnterprises: p.linkedEnterpriseIds
        .map((id) => store.enterprises.find((e) => e.id === id)?.name)
        .filter(Boolean),
    })),
)

const selectedProvider = computed(() =>
  providerList.value.find((p) => p.id === selectedProviderId.value),
)

const contractList = computed(() => {
  if (!selectedProviderId.value) return []
  return store
    .getContractsByProvider(selectedProviderId.value)
    .map((c) => ({
      ...c,
      feeTypeLabel: serviceFeeTypeMap[c.feeType].label,
      statusLabel: contractStatusMap[c.status].label,
      statusType: contractStatusMap[c.status].type,
      settlementLabel: settlementCycleMap[c.settlementCycle],
      baseRateLabel: formatRate(c.feeType, c.baseRate),
      tierCount: c.tiers.length,
      dateRange: c.expiryDate ? `${c.effectiveDate} ~ ${c.expiryDate}` : `${c.effectiveDate} 起`,
    }))
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
})

const summary = computed(() => ({
  total: store.serviceProviders.length,
  cooperating: store.serviceProviders.filter((p) => p.status === 'cooperating').length,
  contracts: store.serviceContracts.filter((c) => c.status === 'active').length,
}))

function selectProvider(id: string) {
  selectedProviderId.value = id
}

function openContractDetail(row: ServiceContract) {
  viewingContract.value = row
  contractDrawer.value = true
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
          合同 {{ provider.activeContractCount }}/{{ provider.contractCount }}
          <span v-if="provider.rating"> · ★ {{ provider.rating }}</span>
        </div>
      </div>
      <el-empty v-if="!providerList.length" description="无匹配服务商" :image-size="60" />
    </aside>

    <section v-if="selectedProvider" class="detail-panel">
      <div class="page-card provider-summary">
        <div class="summary-header">
          <div>
            <h2 class="page-title">{{ selectedProvider.name }}</h2>
            <p class="text-muted">
              {{ selectedProvider.businessScope }} · 合作自 {{ selectedProvider.cooperationStartDate }}
            </p>
          </div>
          <el-tag :type="selectedProvider.statusType">{{ selectedProvider.statusLabel }}</el-tag>
        </div>

        <el-descriptions :column="3" border>
          <el-descriptions-item label="服务商编码">{{ selectedProvider.code }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ selectedProvider.contact }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ selectedProvider.phone }}</el-descriptions-item>
          <el-descriptions-item label="邮箱">
            {{ selectedProvider.email ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="地址" :span="2">
            {{ selectedProvider.address ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="关联企业" :span="3">
            <template v-if="selectedProvider.linkedEnterprises.length">
              <el-tag
                v-for="name in selectedProvider.linkedEnterprises"
                :key="name"
                size="small"
                class="ent-tag"
              >
                {{ name }}
              </el-tag>
            </template>
            <span v-else class="text-muted">暂无关联平台企业</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="selectedProvider.remark" label="备注" :span="3">
            {{ selectedProvider.remark }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="page-card contract-card">
        <div class="page-header">
          <div>
            <h3 class="section-title">合作合同与费率</h3>
            <p class="text-muted">查看合同编号、计费方式及阶梯差价规则</p>
          </div>
        </div>

        <el-table :data="contractList" border stripe empty-text="暂无合同">
          <el-table-column prop="contractNo" label="合同编号" width="150" />
          <el-table-column prop="name" label="合同名称" min-width="180" show-overflow-tooltip />
          <el-table-column label="计费方式" width="110">
            <template #default="{ row }">
              <el-tag size="small">{{ row.feeTypeLabel }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="baseRateLabel" label="基准费率" width="130" />
          <el-table-column label="阶梯" width="80" align="center">
            <template #default="{ row }">{{ row.tierCount }} 档</template>
          </el-table-column>
          <el-table-column prop="settlementLabel" label="结算周期" width="100" />
          <el-table-column prop="dateRange" label="有效期" min-width="170" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.statusType">{{ row.statusLabel }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openContractDetail(row)">费率详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <el-empty v-else description="请选择服务商" class="page-card empty-panel" />
  </div>

  <el-drawer v-model="contractDrawer" title="合同费率详情" size="560px" destroy-on-close>
    <template v-if="viewingContract">
      <el-descriptions :column="1" border class="contract-desc">
        <el-descriptions-item label="合同编号">{{ viewingContract.contractNo }}</el-descriptions-item>
        <el-descriptions-item label="合同名称">{{ viewingContract.name }}</el-descriptions-item>
        <el-descriptions-item label="计费方式">
          {{ serviceFeeTypeMap[viewingContract.feeType].label }}
        </el-descriptions-item>
        <el-descriptions-item label="说明">
          {{ serviceFeeTypeMap[viewingContract.feeType].desc }}
        </el-descriptions-item>
        <el-descriptions-item label="基准费率">
          {{ formatRate(viewingContract.feeType, viewingContract.baseRate) }}
        </el-descriptions-item>
        <el-descriptions-item label="结算周期">
          {{ settlementCycleMap[viewingContract.settlementCycle] }}
        </el-descriptions-item>
        <el-descriptions-item label="有效期">
          {{
            viewingContract.expiryDate
              ? `${viewingContract.effectiveDate} ~ ${viewingContract.expiryDate}`
              : `${viewingContract.effectiveDate} 起`
          }}
        </el-descriptions-item>
        <el-descriptions-item v-if="viewingContract.remark" label="备注">
          {{ viewingContract.remark }}
        </el-descriptions-item>
      </el-descriptions>

      <h4 class="tier-title">阶梯差价</h4>
      <el-table :data="viewingContract.tiers" border stripe size="small">
        <el-table-column label="档位" width="60" align="center">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column label="量级区间" min-width="180">
          <template #default="{ row }">
            {{ formatTierRange(viewingContract!.feeType, row.minQuantity, row.maxQuantity) }}
          </template>
        </el-table-column>
        <el-table-column label="费率" width="140">
          <template #default="{ row }">
            <strong>{{ formatRate(viewingContract!.feeType, row.rate) }}</strong>
          </template>
        </el-table-column>
        <el-table-column prop="label" label="说明" min-width="120">
          <template #default="{ row }">{{ row.label ?? '—' }}</template>
        </el-table-column>
      </el-table>

      <el-alert
        type="info"
        :closable="false"
        style="margin-top: 16px"
        :title="
          viewingContract.feeType === 'percentage'
            ? '结算时按当月累计任务结算额落入对应档位费率计算平台服务费'
            : viewingContract.feeType === 'hourly'
              ? '结算时按当月累计人时落入对应档位单价计费'
              : '结算时按当月累计有效件/次数落入对应档位单价计费'
        "
      />
    </template>
  </el-drawer>
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

.ent-tag {
  margin-right: 6px;
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

.contract-desc {
  margin-bottom: 20px;
}

.tier-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
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
