<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { resolveServiceProviderForEnterprise } from '@/services/billSettlement'
import {
  countConfiguredDepartmentSettlements,
  countConfiguredTaskTypeSettlements,
  listSettlementDepartmentsForEnterprise,
} from '@/services/settlementPrice'

const store = useAppStore()
const router = useRouter()

const keyword = ref('')

const tableData = computed(() =>
  store.enterprises
    .map((ent) => {
      const departments = listSettlementDepartmentsForEnterprise(
        ent.id,
        store.departments,
        store.attendanceGroups,
      )
      const taskTypes = store.getTaskTypesByEnterprise(ent.id)
      const hourlyConfigured = countConfiguredDepartmentSettlements(
        ent.id,
        store.departmentSettlementOverrides,
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
        deptCount: departments.length,
        taskTypeCount: taskTypes.length,
        hourlyConfigured,
        taskConfigured,
      }
    })
    .filter((row) => {
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        row.name.toLowerCase().includes(kw) ||
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
          工时按部门配置结算价（未配置沿用考勤组），任务按任务类型配置灵工结算价
        </p>
      </div>
    </div>

    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索企业名称或服务商"
        clearable
        style="width: 280px"
      />
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column label="企业名称" min-width="180">
        <template #default="{ row }">
          <el-button link type="primary" class="name-link" @click="openDetail(row)">
            {{ row.name }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column prop="code" label="企业编号" width="140" />
      <el-table-column prop="providerName" label="服务商" min-width="180" show-overflow-tooltip />
      <el-table-column label="工时（已配部门价）" width="150" align="center">
        <template #default="{ row }">
          {{ row.hourlyConfigured }} / {{ row.deptCount }}
        </template>
      </el-table-column>
      <el-table-column label="任务（已配灵工价）" width="150" align="center">
        <template #default="{ row }">
          {{ row.taskConfigured }} / {{ row.taskTypeCount }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">查看</el-button>
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

.name-link {
  padding: 0;
  height: auto;
  font-weight: 500;
}
</style>
