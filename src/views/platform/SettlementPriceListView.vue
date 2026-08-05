<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { enterpriseStatusMap } from '@/constants/enterprise'
import {
  countCustomGroupOverrides,
  countCustomTaskTypeOverrides,
  formatHourlySettlement,
} from '@/services/settlementPrice'

const store = useAppStore()
const router = useRouter()

const keyword = ref('')
const statusFilter = ref<'all' | 'active' | 'expiring' | 'terminated'>('all')

const tableData = computed(() =>
  store.enterprises
    .filter((ent) => {
      if (statusFilter.value !== 'all' && ent.status !== statusFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return ent.name.toLowerCase().includes(kw) || ent.code.toLowerCase().includes(kw)
    })
    .map((ent) => {
      const config = store.getEnterpriseSettlementConfig(ent.id)
      const groupCount = store.getAttendanceGroupsByEnterprise(ent.id).length
      const taskTypeCount = store.getTaskTypesByEnterprise(ent.id).length
      const customGroupCount = countCustomGroupOverrides(
        ent.id,
        store.attendanceGroupSettlementOverrides,
      )
      const customTaskCount = countCustomTaskTypeOverrides(
        ent.id,
        store.taskTypeSettlementOverrides,
      )
      return {
        ...ent,
        statusLabel: enterpriseStatusMap[ent.status].label,
        statusType: enterpriseStatusMap[ent.status].type,
        taskUnitPrice: config.taskUnitPrice,
        hourlyLabel: formatHourlySettlement(config),
        groupCount,
        taskTypeCount,
        customGroupCount,
        customTaskCount,
      }
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
          企业默认工时价含白班/夜班及加班、周末、节假日；工时按考勤组、任务按任务类型可单独配置
        </p>
      </div>
    </div>

    <div class="toolbar">
      <el-input v-model="keyword" placeholder="搜索企业名称或编号" clearable style="width: 240px" />
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
      <el-table-column label="企业默认工时价" min-width="200">
        <template #default="{ row }">{{ row.hourlyLabel }}</template>
      </el-table-column>
      <el-table-column label="企业默认任务价" width="130">
        <template #default="{ row }">¥{{ row.taskUnitPrice }}/单</template>
      </el-table-column>
      <el-table-column prop="groupCount" label="考勤组" width="80" align="center" />
      <el-table-column prop="taskTypeCount" label="任务类型" width="90" align="center" />
      <el-table-column label="定制配置" width="160">
        <template #default="{ row }">
          <span v-if="row.customGroupCount || row.customTaskCount" class="custom-summary">
            <span v-if="row.customGroupCount">{{ row.customGroupCount }} 个考勤组</span>
            <span v-if="row.customGroupCount && row.customTaskCount"> · </span>
            <span v-if="row.customTaskCount">{{ row.customTaskCount }} 个任务类型</span>
          </span>
          <span v-else class="text-muted">全部企业默认</span>
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

.custom-summary {
  font-size: 12px;
  color: #606266;
  line-height: 1.4;
}
</style>
