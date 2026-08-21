<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import { resolveEnterpriseIdByAttendanceGroupId } from '@/utils/enterpriseScope'
import {
  buildGrabShiftHistoryRecords,
  resolveGrabSlotDepartmentId,
} from '@/services/grabShift'

const store = useAppStore()
const { enterpriseFilter, matchesEnterprise, enterpriseName, showEnterpriseControl } =
  useEnterpriseScope('filter')

const keyword = ref('')
const deptFilter = ref<'all' | string>('all')

const departmentOptions = computed(() => {
  const depts = store.departments.filter((d) => d.orgType !== 'enterprise')
  return [
    { value: 'all', label: '全部部门' },
    ...depts.map((d) => ({ value: d.id, label: d.name })),
  ]
})

const tableData = computed(() => {
  const kw = keyword.value.trim()
  return buildGrabShiftHistoryRecords({
    applications: store.grabShiftApplications,
    slots: store.grabShiftSlots,
    assignments: store.assignments,
    punches: store.punches,
    employees: store.employees,
    teams: store.teams,
    departments: store.departments,
    resolveEnterpriseId: (attendanceGroupId) =>
      resolveEnterpriseIdByAttendanceGroupId(
        attendanceGroupId,
        store.attendanceGroups,
        store.departments,
      ),
    resolveEnterpriseName: (id) => enterpriseName(id),
  }).filter((row) => {
    if (!matchesEnterprise(row.enterpriseId)) return false
    if (deptFilter.value !== 'all') {
      const slot = store.grabShiftSlots.find((s) => s.id === row.slotId)
      const deptId = slot ? resolveGrabSlotDepartmentId(slot, store.teams) : undefined
      if (deptId !== deptFilter.value) return false
    }
    if (!kw) return true
    return (
      row.workerName.includes(kw) ||
      row.phone.includes(kw) ||
      row.departmentName.includes(kw) ||
      row.shiftName.includes(kw) ||
      row.enterpriseName.includes(kw)
    )
  })
})
</script>

<template>
  <div class="grab-history-page">
    <header class="page-card page-header">
      <div>
        <h2 class="page-title">历史抢班记录</h2>
        <p class="text-muted">
          报名审核通过且已打卡的人员明细 · 共 {{ tableData.length }} 条 · 评价后续开放
        </p>
      </div>
      <div class="header-actions">
        <EnterpriseScopeSelect
          v-if="showEnterpriseControl"
          v-model="enterpriseFilter"
          mode="filter"
          width="180px"
        />
        <el-select v-model="deptFilter" style="width: 180px" placeholder="部门筛选">
          <el-option
            v-for="opt in departmentOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索灵工/手机号/班次"
          style="width: 220px"
        />
      </div>
    </header>

    <div class="page-card">
      <el-table :data="tableData" border stripe>
        <el-table-column prop="enterpriseName" label="企业" min-width="150" show-overflow-tooltip />
        <el-table-column prop="departmentName" label="部门" min-width="140" show-overflow-tooltip />
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="班次" min-width="140">
          <template #default="{ row }">
            {{ row.shiftName }}
            <div class="text-muted">{{ row.shiftTimeRange }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="workerName" label="灵工" width="110" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column label="班次时长" width="110">
          <template #default="{ row }">{{ row.durationHours }} 小时</template>
        </el-table-column>
        <el-table-column label="评价" width="100">
          <template #default>
            <span class="text-muted">—</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!tableData.length" description="暂无历史抢班出勤记录" />
    </div>
  </div>
</template>

<style scoped>
.grab-history-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0 0 4px;
  font-size: 20px;
}

.text-muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
