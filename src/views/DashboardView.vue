<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  buildDailyAttendanceList,
  buildMonthlySummary,
  getMonthDateRange,
} from '@/services/attendance'
import { buildPayrollPreview } from '@/services/payroll'

const store = useAppStore()

onMounted(() => store.syncExceptions())

const stats = computed(() => {
  const month = '2026-07'
  const daily = buildDailyAttendanceList(
    store.activeEmployees.map((e) => e.id),
    getMonthDateRange(month),
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  )
  const summaries = store.activeEmployees.map((emp) =>
    buildMonthlySummary(emp.id, month, daily.filter((d) => d.employeeId === emp.id)),
  )
  const payroll = buildPayrollPreview(
    store.activeEmployees,
    summaries,
    daily,
    store.overtimeRequests,
    store.payrollConfig,
    store.teams,
    store.assignments,
    month,
  )
  const totalPay = payroll.reduce((s, p) => s + p.totalPay, 0)

  return {
    month,
    pendingApprovals: store.pendingApprovalCount,
    openExceptions: store.openExceptionCount,
    totalPayroll: Math.round(totalPay),
    overtimePending: store.overtimeRequests.filter((r) => r.status === 'pending').length,
  }
})
</script>

<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">工作台</h2>
      <span class="text-muted">Phase 3 · 智能排班 + 薪酬 + 分析</span>
    </div>

    <el-row :gutter="16" class="stats-row">
      <el-col :span="6">
        <div class="stat-card blue">
          <div class="stat-value">{{ stats.pendingApprovals }}</div>
          <div class="stat-label">待审批</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card orange">
          <div class="stat-value">{{ stats.openExceptions }}</div>
          <div class="stat-label">考勤异常</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card green">
          <div class="stat-value">¥{{ stats.totalPayroll.toLocaleString() }}</div>
          <div class="stat-label">{{ stats.month }} 预估薪酬</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value">{{ stats.overtimePending }}</div>
          <div class="stat-label">待审加班</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="14">
        <div class="page-card">
          <h3 class="section-title">全流程能力</h3>
          <el-steps :active="5" finish-status="success" align-center style="margin: 24px 0">
            <el-step title="智能排班" description="规则+均衡" />
            <el-step title="考勤打卡" description="自动判定" />
            <el-step title="审批联动" description="假/班/加班" />
            <el-step title="薪酬核算" description="导出/ERP" />
            <el-step title="数据分析" description="成本优化" />
          </el-steps>
          <el-space wrap>
            <el-button type="primary" @click="$router.push('/smart-schedule')">智能排班</el-button>
            <el-button @click="$router.push('/approvals')">审批中心</el-button>
            <el-button type="success" @click="$router.push('/payroll/bills')">薪税账单</el-button>
            <el-button @click="$router.push('/analytics')">数据分析</el-button>
            <el-button @click="$router.push('/attendance-report')">考勤报表</el-button>
          </el-space>
        </div>
      </el-col>
      <el-col :span="10">
        <div class="page-card">
          <h3 class="section-title">集成日志</h3>
          <el-empty v-if="store.integrationLogs.length === 0" description="暂无集成记录" />
          <el-timeline v-else>
            <el-timeline-item
              v-for="log in store.integrationLogs.slice(0, 5)"
              :key="log.id"
              :timestamp="new Date(log.createdAt).toLocaleString('zh-CN')"
            >
              {{ log.action }} · {{ log.recordCount }} 条
            </el-timeline-item>
          </el-timeline>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.stats-row .stat-value {
  font-size: 32px;
  font-weight: 700;
}

.stats-row .stat-label {
  margin-top: 4px;
  opacity: 0.9;
  font-size: 14px;
}

.section-title {
  margin: 0 0 8px;
  font-size: 16px;
}
</style>
