<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { enterpriseStatusMap } from '@/constants/enterprise'
import { resolveServiceProviderForEnterprise } from '@/services/billSettlement'
import {
  countConfiguredGroupSettlements,
  countConfiguredTaskTypeSettlements,
} from '@/services/settlementPrice'

const store = useAppStore()
const router = useRouter()

const keyword = ref('')
const statusFilter = ref<'all' | 'active' | 'expiring' | 'terminated'>('all')

const tableData = computed(() =>
  store.enterprises
    .map((ent) => {
      const groups = store.getAttendanceGroupsByEnterprise(ent.id)
      const taskTypes = store.getTaskTypesByEnterprise(ent.id)
      const hourlyConfigured = countConfiguredGroupSettlements(
        ent.id,
        store.attendanceGroupSettlementOverrides,
      )
      const taskConfigured = countConfiguredTaskTypeSettlements(
        ent.id,
        store.taskTypeSettlementOverrides,
      )
      const provider = resolveServiceProviderForEnterprise(
        ent.id,
        store.serviceProviders,
        store.serviceContracts,
      )
      return {
        ...ent,
        providerName: provider?.name ?? '—',
        statusLabel: enterpriseStatusMap[ent.status].label,
        statusType: enterpriseStatusMap[ent.status].type,
        groupCount: groups.length,
        taskTypeCount: taskTypes.length,
        hourlyConfigured,
        taskConfigured,
      }
    })
    .filter((row) => {
      if (statusFilter.value !== 'all' && row.status !== statusFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        row.name.toLowerCase().includes(kw) ||
        row.code.toLowerCase().includes(kw) ||
        row.providerName.toLowerCase().includes(kw)
      )
    }),
)

function openDetail(row: { id: string }) {
  router.push(`/settlement-prices/${row.id}`)
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">结算价管理</h2>
        <p class="text-muted">
          工时按考勤组、任务按任务类型分别配置灵工结算价；默认展示自身定价，可对照查看
        </p>
      </div>
    </div>

    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索企业名称、编号或服务商"
        clearable
        style="width: 280px"
      />
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="active">合作中</el-radio-button>
        <el-radio-button value="expiring">即将到期</el-radio-button>
        <el-radio-button value="terminated">已终止</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="企业名称" min-width="180" />
      <el-table-column prop="code" label="企业编号" width="140" />
      <el-table-column prop="providerName" label="服务商" min-width="180" show-overflow-tooltip />
      <el-table-column label="工时（已配灵工价）" width="150" align="center">
        <template #default="{ row }">
          {{ row.hourlyConfigured }} / {{ row.groupCount }}
        </template>
      </el-table-column>
      <el-table-column label="任务（已配灵工价）" width="150" align="center">
        <template #default="{ row }">
          {{ row.taskConfigured }} / {{ row.taskTypeCount }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.statusType" size="small">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">配置</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}
</style>
