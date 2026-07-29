<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  buildDailyAttendanceList,
  buildMonthlySummary,
  getMonthDateRange,
} from '@/services/attendance'
import {
  buildPayrollPreview,
  downloadTextFile,
  exportErpJson,
  exportPayrollCsv,
} from '@/services/payroll'

const store = useAppStore()
const selectedMonth = ref('2026-07')
const form = ref({ ...store.payrollConfig })

const payrollItems = computed(() => {
  const employees = store.activeEmployees
  const daily = buildDailyAttendanceList(
    employees.map((e) => e.id),
    getMonthDateRange(selectedMonth.value),
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  )
  const summaries = employees.map((emp) =>
    buildMonthlySummary(emp.id, selectedMonth.value, daily.filter((d) => d.employeeId === emp.id)),
  )
  return buildPayrollPreview(
    employees,
    summaries,
    daily,
    store.overtimeRequests,
    store.payrollConfig,
    store.teams,
    store.assignments,
    selectedMonth.value,
  ).map((item) => ({
    ...item,
    name: store.employees.find((e) => e.id === item.employeeId)?.name ?? '-',
    employeeNo: store.employees.find((e) => e.id === item.employeeId)?.employeeNo ?? '-',
  }))
})

const totals = computed(() => ({
  regularPay: payrollItems.value.reduce((s, i) => s + i.regularPay, 0),
  overtimePay: payrollItems.value.reduce((s, i) => s + i.overtimePay, 0),
  deductions: payrollItems.value.reduce((s, i) => s + i.deductions, 0),
  totalPay: payrollItems.value.reduce((s, i) => s + i.totalPay, 0),
}))

function saveConfig() {
  store.updatePayrollConfig({ ...form.value })
  ElMessage.success('薪酬规则已保存')
}

function exportCsv() {
  const csv = exportPayrollCsv(payrollItems.value, store.employees)
  downloadTextFile(csv, `payroll_${selectedMonth.value}.csv`, 'text/csv;charset=utf-8')
  store.addIntegrationLog({
    type: 'payroll',
    action: '导出薪酬 CSV',
    status: 'success',
    recordCount: payrollItems.value.length,
    message: `${selectedMonth.value} 薪酬 CSV 已导出`,
  })
  ElMessage.success('CSV 已下载')
}

function syncErp() {
  const json = exportErpJson(payrollItems.value, store.employees, store.payrollConfig, selectedMonth.value)
  downloadTextFile(json, `erp_payroll_${selectedMonth.value}.json`, 'application/json;charset=utf-8')
  store.addIntegrationLog({
    type: 'erp',
    action: '同步至 ERP',
    status: 'success',
    recordCount: payrollItems.value.length,
    message: `已生成 ${store.payrollConfig.erpSystemName} 对接数据包`,
  })
  ElMessage.success('ERP 数据包已生成（演示）')
}
</script>

<template>
  <div>
    <div class="page-card">
      <div class="page-header">
        <div>
          <h2 class="page-title">薪酬联动</h2>
          <p class="text-muted">
            时薪按考勤组配置（
            <router-link to="/attendance-groups">考勤组管理</router-link>
            ），此处设置默认时薪与加班倍数
          </p>
        </div>
        <el-space>
          <el-button @click="exportCsv">导出 CSV</el-button>
          <el-button type="primary" @click="syncErp">同步 ERP</el-button>
        </el-space>
      </div>

      <el-form inline style="margin-bottom: 16px">
        <el-form-item label="月份">
          <el-date-picker v-model="selectedMonth" type="month" value-format="YYYY-MM" :clearable="false" />
        </el-form-item>
      </el-form>

      <el-row :gutter="12" style="margin-bottom: 16px">
        <el-col :span="6"><el-statistic title="基本薪酬" :value="totals.regularPay" prefix="¥" /></el-col>
        <el-col :span="6"><el-statistic title="加班薪酬" :value="totals.overtimePay" prefix="¥" /></el-col>
        <el-col :span="6"><el-statistic title="扣款" :value="totals.deductions" prefix="¥" /></el-col>
        <el-col :span="6"><el-statistic title="应发合计" :value="totals.totalPay" prefix="¥" /></el-col>
      </el-row>

      <el-table :data="payrollItems" border stripe>
        <el-table-column prop="employeeNo" label="工号" width="90" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="teamName" label="考勤组" width="120">
          <template #default="{ row }">{{ row.teamName ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="hourlyRate" label="时薪" width="70" />
        <el-table-column prop="regularHours" label="正常工时" width="90" />
        <el-table-column prop="overtimeHours" label="加班(h)" width="80" />
        <el-table-column prop="regularPay" label="基本薪酬" width="100" />
        <el-table-column prop="overtimePay" label="加班薪酬" width="100" />
        <el-table-column prop="deductions" label="扣款" width="80" />
        <el-table-column prop="totalPay" label="应发合计" width="100" />
      </el-table>
    </div>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <div class="page-card">
          <h3 class="section-title">全局薪酬规则</h3>
          <el-form label-width="120px" size="small">
            <el-form-item label="默认时薪">
              <el-input-number v-model="form.defaultHourlyRate" :min="1" /> 元/h
              <span class="text-muted" style="margin-left: 8px">未配置组时薪的考勤组使用</span>
            </el-form-item>
            <el-form-item label="工作日加班">
              <el-input-number v-model="form.weekdayOvertimeMultiplier" :min="1" :step="0.1" :precision="1" /> 倍
            </el-form-item>
            <el-form-item label="周末加班">
              <el-input-number v-model="form.weekendOvertimeMultiplier" :min="1" :step="0.1" :precision="1" /> 倍
            </el-form-item>
            <el-form-item label="节假日加班">
              <el-input-number v-model="form.holidayOvertimeMultiplier" :min="1" :step="0.1" :precision="1" /> 倍
            </el-form-item>
            <el-form-item label="ERP 系统">
              <el-input v-model="form.erpSystemName" />
            </el-form-item>
            <el-form-item label="ERP 接口">
              <el-input v-model="form.erpEndpoint" />
            </el-form-item>
            <el-button type="primary" @click="saveConfig">保存配置</el-button>
          </el-form>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="page-card">
          <h3 class="section-title">集成日志</h3>
          <el-table :data="store.integrationLogs.slice(0, 8)" border size="small" empty-text="暂无记录">
            <el-table-column label="时间" width="160">
              <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
            </el-table-column>
            <el-table-column prop="action" label="操作" min-width="120" />
            <el-table-column prop="recordCount" label="记录数" width="70" />
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'success' ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.section-title {
  margin: 0 0 12px;
  font-size: 16px;
}

a {
  color: #409eff;
  text-decoration: none;
}
</style>
