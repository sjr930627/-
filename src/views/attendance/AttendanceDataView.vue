<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import AttendanceDailyPanel from './AttendanceDailyView.vue'
import AttendanceMonthlyPanel from './AttendanceMonthlyView.vue'

const route = useRoute()
const router = useRouter()
const activeTab = ref<'daily' | 'monthly'>('daily')
const { enterpriseFilter, activeEnterpriseId, showEnterpriseControl } = useEnterpriseScope('switch')

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
  const basePath = route.path.startsWith('/enterprise') ? '/enterprise/attendance-data' : '/attendance-data'
  if (route.query.tab !== tab) {
    router.replace({ path: basePath, query: { tab } })
  }
})

onMounted(() => syncTabFromRoute())

watch(
  () => [route.query.date, route.query.employee] as const,
  ([date, employeeId]) => {
    if (typeof date === 'string' || typeof employeeId === 'string') {
      activeTab.value = 'daily'
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">考勤数据</h2>
        <p class="text-muted">按日查看打卡明细，或按月汇总出勤统计</p>
      </div>
      <EnterpriseScopeSelect
        v-if="showEnterpriseControl"
        v-model="enterpriseFilter"
        mode="switch"
        width="240px"
      />
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="日考勤" name="daily">
        <AttendanceDailyPanel
          embedded
          :enterprise-id="activeEnterpriseId"
          :initial-date="typeof route.query.date === 'string' ? route.query.date : undefined"
          :initial-employee-id="typeof route.query.employee === 'string' ? route.query.employee : undefined"
        />
      </el-tab-pane>
      <el-tab-pane label="月考勤" name="monthly">
        <AttendanceMonthlyPanel embedded :enterprise-id="activeEnterpriseId" />
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
</style>
