<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { formatMoney } from '@/constants/payrollBill'
import {
  formatTaxMonthLabel,
  formatWithdrawalChannel,
  taxDeclarationStatusMap,
} from '@/constants/taxManage'
import type { TaxDeclarationWorker, TaxWithdrawalLine } from '@/types'

const store = useAppStore()

const providerId = ref('sp_zhongqin')
const month = ref('2026-07')
const generating = ref(false)

const providerOptions = computed(() =>
  store.serviceProviders
    .filter((item) => item.status === 'cooperating')
    .map((item) => ({
      value: item.id,
      label: item.shortName ? `${item.name}（${item.shortName}）` : item.name,
    })),
)

watch(providerOptions, (options) => {
  if (!options.some((item) => item.value === providerId.value)) {
    providerId.value = options[0]?.value ?? ''
  }
}, { immediate: true })

const currentDeclaration = computed(() =>
  store.taxDeclarations.find(
    (item) => item.serviceProviderId === providerId.value && item.month === month.value,
  ),
)

const tableData = computed(() =>
  (currentDeclaration.value?.workers ?? []).map((worker) => ({
    ...worker,
    settlementLabel: formatMoney(worker.totalSettlementAmount),
    taxLabel: formatMoney(worker.totalTaxAmount),
    netLabel: formatMoney(worker.totalNetAmount),
    withdrawalRows: worker.withdrawals.map(formatWithdrawalRow),
  })),
)

const summary = computed(() => {
  if (!currentDeclaration.value) {
    return { workerCount: 0, totalSettlementAmount: 0, totalTaxAmount: 0, totalNetAmount: 0 }
  }
  return {
    workerCount: currentDeclaration.value.workerCount,
    totalSettlementAmount: currentDeclaration.value.totalSettlementAmount,
    totalTaxAmount: currentDeclaration.value.totalTaxAmount,
    totalNetAmount: currentDeclaration.value.totalNetAmount,
  }
})

const statusMeta = computed(() =>
  currentDeclaration.value
    ? taxDeclarationStatusMap[currentDeclaration.value.status]
    : null,
)

function formatWithdrawalRow(row: TaxWithdrawalLine) {
  return {
    ...row,
    channelLabel: formatWithdrawalChannel(row.channel),
    settlementLabel: formatMoney(row.settlementAmount),
    taxLabel: formatMoney(row.taxAmount),
    netLabel: formatMoney(row.netAmount),
    withdrawnAtLabel: new Date(row.withdrawnAt).toLocaleString('zh-CN'),
  }
}

function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}

async function handleGenerate() {
  if (!providerId.value || !month.value) return
  generating.value = true
  try {
    store.generateTaxDeclaration(providerId.value, month.value)
    ElMessage.success('月度个税申报表已生成')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '生成失败')
  } finally {
    generating.value = false
  }
}

function handleSubmit() {
  if (!currentDeclaration.value) return
  try {
    store.submitTaxDeclaration(currentDeclaration.value.id)
    ElMessage.success('申报表已提交')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败')
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">个税管理</h2>
        <p class="text-muted">按服务商维度生成月度个税申报表，汇总灵工结算与代扣个税，展开查看每笔提现明细</p>
      </div>
      <div class="header-actions">
        <el-button
          v-if="currentDeclaration?.status === 'generated'"
          type="primary"
          @click="handleSubmit"
        >
          提交申报
        </el-button>
        <el-button
          v-if="!currentDeclaration"
          type="primary"
          :loading="generating"
          @click="handleGenerate"
        >
          生成月度申报表
        </el-button>
      </div>
    </div>

    <div class="page-toolbar">
      <el-select v-model="providerId" placeholder="选择服务商" style="width: 320px">
        <el-option
          v-for="item in providerOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-date-picker
        v-model="month"
        type="month"
        value-format="YYYY-MM"
        placeholder="申报月份"
        style="width: 160px"
      />
    </div>

    <template v-if="currentDeclaration">
      <el-descriptions :column="4" border class="summary-desc">
        <el-descriptions-item label="申报表编号">{{ currentDeclaration.declarationNo }}</el-descriptions-item>
        <el-descriptions-item label="服务商">{{ currentDeclaration.serviceProviderName }}</el-descriptions-item>
        <el-descriptions-item label="申报月份">{{ formatTaxMonthLabel(currentDeclaration.month) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag v-if="statusMeta" size="small" :type="statusMeta.type">{{ statusMeta.label }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="灵工数">{{ summary.workerCount }}</el-descriptions-item>
        <el-descriptions-item label="结算金额合计">{{ formatMoney(summary.totalSettlementAmount) }}</el-descriptions-item>
        <el-descriptions-item label="个税合计">{{ formatMoney(summary.totalTaxAmount) }}</el-descriptions-item>
        <el-descriptions-item label="到账合计">{{ formatMoney(summary.totalNetAmount) }}</el-descriptions-item>
        <el-descriptions-item label="生成时间">{{ formatTime(currentDeclaration.generatedAt) }}</el-descriptions-item>
      </el-descriptions>

      <h3 class="section-title">灵工申报明细</h3>

      <el-table :data="tableData" border stripe row-key="employeeId">
        <el-table-column type="expand" width="48">
          <template #default="{ row }: { row: TaxDeclarationWorker & { withdrawalRows: ReturnType<typeof formatWithdrawalRow>[] } }">
            <div class="expand-panel">
              <el-table :data="row.withdrawalRows" border size="small">
                <el-table-column prop="withdrawalNo" label="提现单号" min-width="160" />
                <el-table-column prop="channelLabel" label="提现通道" width="100" />
                <el-table-column prop="settlementLabel" label="结算金额" width="120" align="right" />
                <el-table-column prop="taxLabel" label="个税金额" width="110" align="right" />
                <el-table-column prop="netLabel" label="到账金额" width="120" align="right" />
                <el-table-column prop="withdrawnAtLabel" label="提现时间" min-width="170" />
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="employeeName" label="灵工" width="100" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column prop="idCardNo" label="身份证号" min-width="170" />
        <el-table-column prop="settlementLabel" label="总计结算金额" width="140" align="right" />
        <el-table-column prop="taxLabel" label="个税金额" width="120" align="right" />
        <el-table-column prop="netLabel" label="总计到账金额" width="140" align="right" />
        <el-table-column label="提现笔数" width="90" align="center">
          <template #default="{ row }">{{ row.withdrawals.length }}</template>
        </el-table-column>
      </el-table>

      <p class="toolbar-hint">展开灵工行可查看每笔提现对应的结算金额、个税金额与到账金额</p>
    </template>

    <el-empty v-else description="该服务商所选月份暂无申报表">
      <el-button type="primary" :loading="generating" @click="handleGenerate">
        生成 {{ formatTaxMonthLabel(month) }} 申报表
      </el-button>
    </el-empty>
  </div>
</template>

<style scoped>
.header-actions {
  display: flex;
  gap: 8px;
}

.page-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.summary-desc {
  margin-bottom: 20px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}

.expand-panel {
  padding: 8px 12px 12px 48px;
}

.toolbar-hint {
  margin-top: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
