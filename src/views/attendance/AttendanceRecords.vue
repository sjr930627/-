<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { simulatePunchTime } from '@/services/attendance'

const store = useAppStore()
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const filterEmployee = ref('')

onMounted(() => store.syncExceptions())

const tableData = computed(() =>
  [...store.punches]
    .filter((p) => {
      if (p.date !== selectedDate.value) return false
      if (filterEmployee.value && p.employeeId !== filterEmployee.value) return false
      return true
    })
    .sort((a, b) => b.time.localeCompare(a.time))
    .map((p) => ({
      ...p,
      employeeName: store.employees.find((e) => e.id === p.employeeId)?.name ?? '-',
      typeLabel: p.type === 'clock_in' ? '上班' : '下班',
      sourceLabel: { mobile: '移动端', manual: '手动', access_control: '门禁' }[p.source],
    })),
)

const punchForm = ref({
  employeeId: store.activeEmployees[0]?.id ?? '',
  type: 'clock_in' as 'clock_in' | 'clock_out',
  time: '08:05',
  inRange: true,
  location: '一车间',
})

function simulatePunch(scenario: 'normal' | 'late' | 'early' = 'normal') {
  const empId = punchForm.value.employeeId
  if (!empId) {
    ElMessage.warning('请选择员工')
    return
  }
  const assignment = store.getAssignment(empId, selectedDate.value)
  const shift = assignment ? store.shifts.find((s) => s.id === assignment.shiftId) : undefined
  if (!shift || shift.code === 'REST') {
    ElMessage.warning('该员工当日无工作班次')
    return
  }
  const time = simulatePunchTime(shift, punchForm.value.type, scenario)
  store.addPunch({
    employeeId: empId,
    date: selectedDate.value,
    time,
    type: punchForm.value.type,
    source: 'mobile',
    location: punchForm.value.location,
    inRange: punchForm.value.inRange,
  })
  ElMessage.success(`已模拟${punchForm.value.type === 'clock_in' ? '上班' : '下班'}打卡 ${time}`)
}

function manualPunch() {
  if (!punchForm.value.employeeId) {
    ElMessage.warning('请选择员工')
    return
  }
  store.addPunch({
    employeeId: punchForm.value.employeeId,
    date: selectedDate.value,
    time: punchForm.value.time,
    type: punchForm.value.type,
    source: 'manual',
    location: punchForm.value.location,
    inRange: punchForm.value.inRange,
  })
  ElMessage.success('打卡记录已添加')
}
</script>

<template>
  <div>
    <div class="page-card">
      <div class="page-header">
        <div>
          <h2 class="page-title">考勤打卡</h2>
          <p class="text-muted">查看打卡记录，模拟移动端/GPS 打卡（演示）</p>
        </div>
        <el-button @click="$router.push('/attendance-groups')">考勤组</el-button>
      </div>

      <el-row :gutter="16">
        <el-col :span="10">
          <el-card shadow="never">
            <template #header>模拟打卡</template>
            <el-form label-width="80px">
              <el-form-item label="日期">
                <el-date-picker v-model="selectedDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
              </el-form-item>
              <el-form-item label="员工">
                <el-select v-model="punchForm.employeeId" filterable style="width: 100%">
                  <el-option
                    v-for="e in store.activeEmployees"
                    :key="e.id"
                    :label="`${e.name} (${e.employeeNo})`"
                    :value="e.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="类型">
                <el-radio-group v-model="punchForm.type">
                  <el-radio value="clock_in">上班</el-radio>
                  <el-radio value="clock_out">下班</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="定位">
                <el-input v-model="punchForm.location" />
              </el-form-item>
              <el-form-item label="范围内">
                <el-switch v-model="punchForm.inRange" />
              </el-form-item>
              <el-form-item>
                <el-space wrap>
                  <el-button type="primary" @click="simulatePunch('normal')">正常打卡</el-button>
                  <el-button type="warning" @click="simulatePunch('late')">模拟迟到</el-button>
                  <el-button type="warning" @click="simulatePunch('early')">模拟早退</el-button>
                </el-space>
              </el-form-item>
              <el-divider>手动录入</el-divider>
              <el-form-item label="时间">
                <el-time-select
                  v-model="punchForm.time"
                  start="00:00"
                  step="00:01"
                  end="23:59"
                  style="width: 100%"
                />
              </el-form-item>
              <el-button @click="manualPunch">添加记录</el-button>
            </el-form>
          </el-card>
        </el-col>
        <el-col :span="14">
          <el-form inline style="margin-bottom: 12px">
            <el-form-item label="筛选员工">
              <el-select v-model="filterEmployee" clearable style="width: 160px">
                <el-option
                  v-for="e in store.activeEmployees"
                  :key="e.id"
                  :label="e.name"
                  :value="e.id"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <el-table :data="tableData" border stripe empty-text="当日暂无打卡记录">
            <el-table-column prop="employeeName" label="员工" width="100" />
            <el-table-column prop="typeLabel" label="类型" width="80" />
            <el-table-column prop="time" label="时间" width="80" />
            <el-table-column prop="sourceLabel" label="来源" width="90" />
            <el-table-column prop="location" label="位置" min-width="100" />
            <el-table-column label="定位" width="90">
              <template #default="{ row }">
                <el-tag :type="row.inRange ? 'success' : 'danger'" size="small">
                  {{ row.inRange ? '正常' : '异常' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button link type="danger" @click="store.removePunch(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-col>
      </el-row>
    </div>
  </div>
</template>
