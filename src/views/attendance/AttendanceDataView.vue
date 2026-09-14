<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown } from '@element-plus/icons-vue'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import AttendanceDailyPanel from './AttendanceDailyView.vue'
import AttendanceMonthlyPanel from './AttendanceMonthlyView.vue'
import type { AttendanceAssignmentSource } from '@/services/attendance'

const route = useRoute()
const router = useRouter()
const activeTab = ref<'daily' | 'monthly'>('daily')
const dailyPanelRef = ref<{ exportCsv: () => void } | null>(null)
const monthlyPanelRef = ref<{ exportCsv: () => void } | null>(null)
const { enterpriseFilter, activeEnterpriseId, showEnterpriseControl } = useEnterpriseScope('switch')

const assignmentSource = computed<AttendanceAssignmentSource>(() =>
  route.meta.assignmentSource === 'grab' ? 'grab' : 'schedule',
)

const sourceLabel = computed(() => (assignmentSource.value === 'grab' ? '抢班' : '排班'))

const basePath = computed(() => {
  if (route.path.startsWith('/enterprise')) {
    return assignmentSource.value === 'grab'
      ? '/enterprise/grab-attendance-data'
      : '/enterprise/attendance-data'
  }
  return assignmentSource.value === 'grab' ? '/grab-attendance-data' : '/attendance-data'
})

function syncTabFromRoute() {
  const tab = route.query.tab
  activeTab.value = tab === 'monthly' ? 'monthly' : 'daily'
}

watch(
  () => route.query.tab,
  () => syncTabFromRoute(),
  { immediate: true },
)

watch(activeTab, (tab) => {
  if (route.query.tab !== tab) {
    router.replace({ path: basePath.value, query: { ...route.query, tab } })
  }
})

function onExportCommand(command: 'daily' | 'monthly') {
  if (command === 'daily') {
    dailyPanelRef.value?.exportCsv()
    return
  }
  monthlyPanelRef.value?.exportCsv()
}

onMounted(() => syncTabFromRoute())
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">考勤数据</h2>
        <p class="text-muted">
          {{ sourceLabel }}来源 · 按日查看打卡明细、确认/矫正工时，或按月汇总出勤统计
        </p>
      </div>
      <div class="header-actions">
        <EnterpriseScopeSelect
          v-if="showEnterpriseControl"
          v-model="enterpriseFilter"
          mode="switch"
          width="240px"
        />
        <el-dropdown trigger="click" @command="onExportCommand">
          <el-button type="primary">
            导出
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="daily">导出日考勤</el-dropdown-item>
              <el-dropdown-item command="monthly">导出月考勤</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="日考勤" name="daily">
        <AttendanceDailyPanel
          ref="dailyPanelRef"
          embedded
          :enterprise-id="activeEnterpriseId"
          :assignment-source="assignmentSource"
          :initial-date="typeof route.query.date === 'string' ? route.query.date : undefined"
          :initial-employee-id="typeof route.query.employee === 'string' ? route.query.employee : undefined"
        />
      </el-tab-pane>
      <el-tab-pane label="月考勤" name="monthly">
        <AttendanceMonthlyPanel
          ref="monthlyPanelRef"
          embedded
          :enterprise-id="activeEnterpriseId"
          :assignment-source="assignmentSource"
          :initial-employee-id="typeof route.query.employee === 'string' ? route.query.employee : undefined"
          :initial-month="typeof route.query.month === 'string' ? route.query.month : undefined"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
</style>
