<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useWorkbenchTodos } from '@/composables/useWorkbenchTodos'
import { usePortal } from '@/composables/usePortal'
import WorkbenchMetricRow from '@/components/workbench/WorkbenchMetricRow.vue'
import WorkbenchRecruitmentProgress from '@/components/workbench/WorkbenchRecruitmentProgress.vue'
import WorkbenchTodoList from '@/components/workbench/WorkbenchTodoList.vue'
import WorkbenchAttendanceAlerts from '@/components/workbench/WorkbenchAttendanceAlerts.vue'
import WorkbenchRecruitmentOverview from '@/components/workbench/WorkbenchRecruitmentOverview.vue'

const store = useAppStore()
const { isEnterprise } = usePortal()
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
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-subtitle">{{ isEnterprise ? '企业端' : '平台端' }} · HR 与招聘运营概览</p>
      </div>
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
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}

.page-subtitle {
  margin: 6px 0 0;
  font-size: 14px;
  color: #94a3b8;
}

.workbench-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 1fr);
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
