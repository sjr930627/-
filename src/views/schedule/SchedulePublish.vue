<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { detectAllConflicts, getMonthAssignmentStats } from '@/services/schedule'

const store = useAppStore()

const now = new Date()
const selectedMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const selectedTeamId = ref(store.teams[0]?.id ?? '')

const team = computed(() => store.teams.find((t) => t.id === selectedTeamId.value))

const monthAssignments = computed(() => {
  const memberIds = new Set(team.value?.memberIds ?? [])
  return store.assignments.filter(
    (a) =>
      a.date.startsWith(selectedMonth.value) &&
      a.teamId === selectedTeamId.value &&
      memberIds.has(a.employeeId),
  )
})

const unpublishedCount = computed(() => monthAssignments.value.filter((a) => !a.published).length)
const publishedCount = computed(() => monthAssignments.value.filter((a) => a.published).length)

const conflicts = computed(() =>
  detectAllConflicts(
    store.assignments,
    store.employees,
    store.shifts,
    store.holidays,
    store.scheduleRule,
    { teamId: selectedTeamId.value, month: selectedMonth.value },
  ),
)

const stats = computed(() => {
  const memberIds = team.value?.memberIds ?? []
  return getMonthAssignmentStats(
    store.assignments,
    store.shifts,
    memberIds,
    selectedMonth.value,
  ).map((s) => ({
    ...s,
    name: store.employees.find((e) => e.id === s.employeeId)?.name ?? '-',
  }))
})

async function publish() {
  if (!selectedTeamId.value) {
    ElMessage.warning('请选择班组')
    return
  }
  if (monthAssignments.value.length === 0) {
    ElMessage.warning('当前月份暂无排班数据')
    return
  }
  if (conflicts.value.length > 0) {
    await ElMessageBox.confirm(
      `仍有 ${conflicts.value.length} 处冲突，确定继续发布？`,
      '冲突警告',
      { type: 'warning' },
    )
  }
  try {
    const record = store.publishSchedule(selectedMonth.value, selectedTeamId.value)
    ElMessage.success(`发布成功，已通知 ${record.assignmentCount} 条排班`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}
</script>

<template>
  <div>
    <div class="page-card">
      <div class="page-header">
        <div>
          <h2 class="page-title">排班发布</h2>
          <p class="text-muted">确认排班无误后发布，系统将通知相关员工</p>
        </div>
      </div>

      <el-form inline>
        <el-form-item label="月份">
          <el-date-picker
            v-model="selectedMonth"
            type="month"
            value-format="YYYY-MM"
            :clearable="false"
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item label="班组">
          <el-select v-model="selectedTeamId" style="width: 180px">
            <el-option v-for="t in store.teams" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
      </el-form>

      <el-row :gutter="16" style="margin: 16px 0">
        <el-col :span="6">
          <el-statistic title="排班总数" :value="monthAssignments.length" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="待发布" :value="unpublishedCount" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="已发布" :value="publishedCount" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="冲突数" :value="conflicts.length" />
        </el-col>
      </el-row>

      <el-alert
        v-if="conflicts.length > 0"
        type="error"
        :closable="false"
        style="margin-bottom: 16px"
      >
        <template #title>发布前请处理冲突</template>
        <ul style="margin: 8px 0 0; padding-left: 20px">
          <li v-for="(c, i) in conflicts.slice(0, 5)" :key="i">
            {{ store.employees.find((e) => e.id === c.employeeId)?.name }} · {{ c.date }} · {{ c.message }}
          </li>
          <li v-if="conflicts.length > 5">... 还有 {{ conflicts.length - 5 }} 处</li>
        </ul>
      </el-alert>

      <el-button type="primary" size="large" :disabled="monthAssignments.length === 0" @click="publish">
        发布 {{ selectedMonth }} 排班表
      </el-button>
      <el-button size="large" @click="$router.push('/schedule')">返回排班表编辑</el-button>
    </div>

    <div class="page-card" style="margin-top: 16px">
      <h3 class="section-title">员工工时统计</h3>
      <el-table :data="stats" border stripe>
        <el-table-column prop="name" label="员工" width="120" />
        <el-table-column prop="workDays" label="出勤天数" width="100" />
        <el-table-column prop="restDays" label="休息天数" width="100" />
        <el-table-column prop="totalHours" label="总工时(h)" width="100" />
        <el-table-column label="月工时上限">
          <template #default="{ row }">
            <el-progress
              :percentage="Math.min(100, Math.round((row.totalHours / store.scheduleRule.maxMonthlyHours) * 100))"
              :status="row.totalHours > store.scheduleRule.maxMonthlyHours ? 'exception' : undefined"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="page-card" style="margin-top: 16px">
      <h3 class="section-title">发布历史</h3>
      <el-table
        :data="store.publishRecords.filter((r) => r.teamId === selectedTeamId)"
        border
        stripe
        empty-text="暂无发布记录"
      >
        <el-table-column prop="month" label="月份" width="100" />
        <el-table-column label="班组" min-width="140">
          <template #default="{ row }">
            {{ store.teams.find((t) => t.id === row.teamId)?.name }}
          </template>
        </el-table-column>
        <el-table-column prop="assignmentCount" label="排班数" width="90" />
        <el-table-column prop="publishedBy" label="发布人" width="100" />
        <el-table-column label="发布时间" min-width="180">
          <template #default="{ row }">
            {{ new Date(row.publishedAt).toLocaleString('zh-CN') }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.section-title {
  margin: 0 0 12px;
  font-size: 16px;
}
</style>
