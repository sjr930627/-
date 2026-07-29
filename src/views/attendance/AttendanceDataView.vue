<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AttendanceDailyPanel from './AttendanceDailyView.vue'
import AttendanceMonthlyPanel from './AttendanceMonthlyView.vue'

const route = useRoute()
const router = useRouter()
const activeTab = ref<'daily' | 'monthly'>('daily')

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
    router.replace({ path: '/attendance-data', query: { tab } })
  }
})

onMounted(() => syncTabFromRoute())
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">考勤数据</h2>
        <p class="text-muted">按日查看打卡明细，或按月汇总出勤统计</p>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="日考勤" name="daily">
        <AttendanceDailyPanel embedded />
      </el-tab-pane>
      <el-tab-pane label="月考勤" name="monthly">
        <AttendanceMonthlyPanel embedded />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
