<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  generateSmartSchedule,
  recommendEmployeesForShift,
} from '@/services/smartSchedule'

const store = useAppStore()
const route = useRoute()

const selectedGroupId = ref('ag_factory')
const selectedMonth = ref('2026-08')
const selectedTeamId = ref('')
const primaryShiftId = ref('shift_morning')
const restShiftId = ref('shift_rest')
const requiredSkills = ref<string[]>([])

const recommendDate = ref('2026-08-01')
const recommendShiftId = ref('shift_morning')

const availableTeams = computed(() => store.getTeamsForGroup(selectedGroupId.value))

const activeScheduleRule = computed(() => store.getScheduleRuleForGroup(selectedGroupId.value))

const selectedGroup = computed(() =>
  store.attendanceGroups.find((g) => g.id === selectedGroupId.value),
)

watch(
  () => route.query.group,
  (group) => {
    if (typeof group === 'string' && store.attendanceGroups.some((g) => g.id === group)) {
      selectedGroupId.value = group
    }
  },
  { immediate: true },
)

watch(
  availableTeams,
  (teams) => {
    if (!teams.some((t) => t.id === selectedTeamId.value)) {
      selectedTeamId.value = teams[0]?.id ?? ''
    }
  },
  { immediate: true },
)

const team = computed(() => availableTeams.value.find((t) => t.id === selectedTeamId.value))

const lastResult = ref<ReturnType<typeof generateSmartSchedule> | null>(null)

const skillOptions = ['叉车证', '急救证', '高级技师', '电工证', '质检员证']

function runSmartSchedule() {
  if (!team.value) {
    ElMessage.warning('请选择班组')
    return
  }
  const result = generateSmartSchedule(
    team.value,
    store.employees,
    store.shifts,
    store.holidays,
    store.leaveRequests,
    store.assignments,
    activeScheduleRule.value,
    {
      teamId: selectedTeamId.value,
      month: selectedMonth.value,
      primaryShiftId: primaryShiftId.value,
      restShiftId: restShiftId.value,
    },
  )
  lastResult.value = result
  ElMessage.info(result.message)
}

async function applySchedule() {
  if (!lastResult.value?.assignments.length) {
    ElMessage.warning('请先生成排班方案')
    return
  }
  await ElMessageBox.confirm(
    `将覆盖 ${selectedMonth.value} ${team.value?.name} 的现有排班，共 ${lastResult.value.assignments.length} 条，确定应用？`,
    '确认应用',
    { type: 'warning' },
  )
  store.applySmartSchedule(lastResult.value.assignments)
  ElMessage.success('智能排班已应用到排班表')
}

const recommendations = computed(() => {
  if (!team.value) return []
  return recommendEmployeesForShift(
    recommendDate.value,
    recommendShiftId.value,
    team.value,
    store.employees,
    store.assignments,
    store.shifts,
    store.holidays,
    activeScheduleRule.value,
    requiredSkills.value,
  ).map((r) => ({
    ...r,
    name: store.employees.find((e) => e.id === r.employeeId)?.name ?? '-',
    employeeNo: store.employees.find((e) => e.id === r.employeeId)?.employeeNo ?? '-',
  }))
})

const balancedList = computed(() => {
  if (!lastResult.value) return []
  return Object.entries(lastResult.value.balancedHours).map(([empId, hours]) => ({
    empId,
    name: store.employees.find((e) => e.id === empId)?.name ?? '-',
    hours,
  }))
})

const workShifts = computed(() => store.shifts.filter((s) => s.code !== 'REST'))
</script>

<template>
  <div>
    <div class="page-card">
      <div class="page-header">
        <div>
          <h2 class="page-title">智能排班</h2>
          <p class="text-muted">
            基于考勤组排班规则、偏好与工时均衡一键生成方案
            <template v-if="selectedGroup"> · {{ selectedGroup.name }}</template>
          </p>
        </div>
      </div>

      <el-row :gutter="16">
        <el-col :span="14">
          <el-form label-width="100px">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="考勤组">
                  <el-select v-model="selectedGroupId" style="width: 100%">
                    <el-option
                      v-for="g in store.attendanceGroups.filter((x) => x.attendanceType === 'shift' && x.status === 'enabled')"
                      :key="g.id"
                      :label="g.name"
                      :value="g.id"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="月份">
                  <el-date-picker v-model="selectedMonth" type="month" value-format="YYYY-MM" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="班组">
                  <el-select v-model="selectedTeamId" style="width: 100%" :disabled="!availableTeams.length">
                    <el-option v-for="t in availableTeams" :key="t.id" :label="t.name" :value="t.id" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="主班次">
                  <el-select v-model="primaryShiftId" style="width: 100%">
                    <el-option v-for="s in workShifts" :key="s.id" :label="s.name" :value="s.id" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="休息班次">
                  <el-select v-model="restShiftId" style="width: 100%">
                    <el-option v-for="s in store.shifts" :key="s.id" :label="s.name" :value="s.id" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item>
              <el-button type="primary" @click="runSmartSchedule">一键生成</el-button>
              <el-button type="success" :disabled="!lastResult" @click="applySchedule">应用到排班表</el-button>
              <el-button @click="$router.push({ path: '/schedule-manage', query: { group: selectedGroupId, tab: 'board' } })">
                查看排班表
              </el-button>
            </el-form-item>
          </el-form>

          <el-alert
            v-if="lastResult"
            :title="lastResult.message"
            :type="lastResult.conflictCount > 0 ? 'warning' : 'success'"
            :closable="false"
            style="margin-top: 12px"
          />

          <div v-if="balancedList.length" style="margin-top: 16px">
            <h4 class="sub-title">工时均衡预览</h4>
            <el-table :data="balancedList" border size="small">
              <el-table-column prop="name" label="员工" />
              <el-table-column prop="hours" label="预计月工时(h)" width="140" />
            </el-table>
          </div>
        </el-col>

        <el-col :span="10">
          <el-card shadow="never">
            <template #header>人员推荐</template>
            <el-form label-width="80px" size="small">
              <el-form-item label="日期">
                <el-date-picker v-model="recommendDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
              </el-form-item>
              <el-form-item label="班次">
                <el-select v-model="recommendShiftId" style="width: 100%">
                  <el-option v-for="s in workShifts" :key="s.id" :label="s.name" :value="s.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="技能要求">
                <el-select v-model="requiredSkills" multiple style="width: 100%">
                  <el-option v-for="s in skillOptions" :key="s" :label="s" :value="s" />
                </el-select>
              </el-form-item>
            </el-form>
            <el-table :data="recommendations.slice(0, 5)" border size="small" empty-text="暂无推荐">
              <el-table-column prop="name" label="员工" width="80" />
              <el-table-column prop="score" label="评分" width="60" />
              <el-table-column label="理由" min-width="140">
                <template #default="{ row }">{{ row.reasons.join('；') || '—' }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<style scoped>
.sub-title {
  margin: 0 0 8px;
  font-size: 14px;
}
</style>
