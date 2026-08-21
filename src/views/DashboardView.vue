<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useWorkbenchTodos } from '@/composables/useWorkbenchTodos'
import WorkbenchMetricRow from '@/components/workbench/WorkbenchMetricRow.vue'
import WorkbenchRecruitmentProgress from '@/components/workbench/WorkbenchRecruitmentProgress.vue'
import WorkbenchTodoList from '@/components/workbench/WorkbenchTodoList.vue'
import WorkbenchAttendanceAlerts from '@/components/workbench/WorkbenchAttendanceAlerts.vue'
import WorkbenchRecruitmentOverview from '@/components/workbench/WorkbenchRecruitmentOverview.vue'

const store = useAppStore()
const {
  flatTodos,
  metrics,
  recruitmentReminders,
  attendanceAlerts,
  recruitmentFunnel,
  departmentOpenRoles,
} = useWorkbenchTodos()

onMounted(() => store.syncExceptions())
</script>

<template>
  <div class="workbench-page">
    <div class="page-header">
      <h2 class="page-title">工作台</h2>
    </div>

    <WorkbenchMetricRow :metrics="metrics" />

    <div class="workbench-grid">
      <div class="grid-main">
        <WorkbenchRecruitmentProgress :reminders="recruitmentReminders" />
        <WorkbenchTodoList :todos="flatTodos" />
      </div>

      <div class="grid-side">
        <WorkbenchAttendanceAlerts :items="attendanceAlerts" />
        <WorkbenchRecruitmentOverview
          :funnel="recruitmentFunnel"
          :departments="departmentOpenRoles"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.workbench-page {
  min-height: 100%;
}

.page-header {
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

.workbench-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.9fr);
  gap: 16px;
  align-items: start;
}

.grid-main,
.grid-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 1100px) {
  .workbench-grid {
    grid-template-columns: 1fr;
  }
}
</style>
