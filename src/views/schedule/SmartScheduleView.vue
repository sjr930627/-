<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  generateSmartSchedule,
  recommendEmployeesForShift,
} from '@/services/smartSchedule'
import { resolveShiftIdForTemplate } from '@/services/scheduleGroup'
import {
  createShiftDemandHeadcountResolver,
  hasShiftDemandInRange,
  summarizeConfiguredShiftDemands,
} from '@/services/shiftDemandPlan'
import { getMonthDays } from '@/utils'

const store = useAppStore()
const route = useRoute()

const selectedGroupId = ref('ag_factory')
const selectedMonth = ref('2026-08')
const selectedTeamId = ref('')
const selectedEmployeeIds = ref<string[]>([])
const requiredSkills = ref<string[]>([])

const recommendDate = ref('2026-08-01')
const recommendShiftId = ref('shift_morning')

const availableTeams = computed(() => store.getTeamsForGroup(selectedGroupId.value))

const selectedGroup = computed(() =>
  store.attendanceGroups.find((g) => g.id === selectedGroupId.value),
)

const activeScheduleRule = computed(() => store.getScheduleRuleForGroup(selectedGroupId.value))

const groupCompliance = computed(() => {
  if (selectedGroup.value?.compliance) return selectedGroup.value.compliance
  const rule = activeScheduleRule.value
  return {
    maxDailyHours: rule.maxDailyHours,
    maxWeeklyHours: rule.maxWeeklyHours,
    maxMonthlyHours: rule.maxMonthlyHours,
    maxConsecutiveWorkdays: rule.maxConsecutiveDays,
    minShiftIntervalHours: rule.minRestHours,
  }
})

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

const employeeOptions = computed(() =>
  store.activeEmployees.filter((e) => team.value?.memberIds.includes(e.id)),
)

watch(
  team,
  (t) => {
    selectedEmployeeIds.value = t?.memberIds ? [...t.memberIds] : []
  },
  { immediate: true },
)

const allSelected = computed({
  get: () =>
    employeeOptions.value.length > 0 &&
    employeeOptions.value.every((e) => selectedEmployeeIds.value.includes(e.id)),
  set: (val: boolean) => {
    selectedEmployeeIds.value = val ? employeeOptions.value.map((e) => e.id) : []
  },
})

const resolveShiftIdByTemplateName = (name: string) =>
  resolveShiftIdForTemplate(name, store.shifts) ?? undefined

const smartMonthRange = computed(() => {
  const [year, monthNum] = selectedMonth.value.split('-').map(Number)
  const days = getMonthDays(year, monthNum)
  return {
    startDate: days[0] ?? '',
    endDate: days[days.length - 1] ?? '',
  }
})

const shiftDemands = computed(() =>
  summarizeConfiguredShiftDemands(
    smartMonthRange.value.startDate,
    smartMonthRange.value.endDate,
    selectedTeamId.value,
    selectedGroup.value?.shiftTemplates ?? [],
    store.shifts,
    store.holidays,
    store.weeklyShiftDemandPlans,
    resolveShiftIdByTemplateName,
  ),
)

const smartDemandHeadcountResolver = computed(() =>
  createShiftDemandHeadcountResolver({
    teamId: selectedTeamId.value,
    templates: selectedGroup.value?.shiftTemplates ?? [],
    holidays: store.holidays,
    plans: store.weeklyShiftDemandPlans,
    resolveShiftId: resolveShiftIdByTemplateName,
  }),
)

const lastResult = ref<ReturnType<typeof generateSmartSchedule> | null>(null)

const skillOptions = ['叉车证', '急救证', '高级技师', '电工证', '质检员证']

function runSmartSchedule() {
  if (!team.value) {
    ElMessage.warning('请选择班组')
    return
  }
  if (!selectedEmployeeIds.value.length) {
    ElMessage.warning('请选择参与排班的人员')
    return
  }
  if (
    !hasShiftDemandInRange(
      smartMonthRange.value.startDate,
      smartMonthRange.value.endDate,
      selectedTeamId.value,
      selectedGroup.value?.shiftTemplates ?? [],
      store.holidays,
      store.weeklyShiftDemandPlans,
      resolveShiftIdByTemplateName,
    )
  ) {
    ElMessage.warning('请先在班次需求配置中设置当前区间人数')
    return
  }
  const result = generateSmartSchedule(
    team.value,
    store.employees,
    store.shifts,
    store.holidays,
    store.leaveRequests,
    store.assignments,
    groupCompliance.value,
    {
      teamId: selectedTeamId.value,
      month: selectedMonth.value,
      employeeIds: selectedEmployeeIds.value,
      shiftDemands: shiftDemands.value.map((d) => ({
        shiftId: d.shiftId,
        templateName: d.templateName,
        requiredHeadcount: Math.ceil(d.avgNeeded),
      })),
      getDateHeadcount: (date, shiftId) => smartDemandHeadcountResolver.value(date, shiftId),
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
    groupCompliance.value,
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
            根据考勤组每日班次需求，从所选人员中智能匹配排班方案
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
            </el-row>
            <el-form-item label="选择人员">
              <div class="emp-picker">
                <el-checkbox v-model="allSelected">全选</el-checkbox>
                <el-select
                  v-model="selectedEmployeeIds"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  placeholder="选择参与排班的人员"
                  style="width: 100%"
                >
                  <el-option
                    v-for="emp in employeeOptions"
                    :key="emp.id"
                    :label="`${emp.name}（${emp.employeeNo}）`"
                    :value="emp.id"
                  />
                </el-select>
              </div>
            </el-form-item>
            <el-form-item label="班次需求">
              <div v-if="shiftDemands.some((d) => d.hasDemand)" class="demand-list">
                <div v-for="d in shiftDemands.filter((x) => x.hasDemand)" :key="d.shiftId" class="demand-item">
                  <i v-if="d.shift" class="shift-dot" :style="{ background: d.shift.color }" />
                  <span>{{ d.templateName }}</span>
                  <span class="text-muted">{{ d.startTime }}-{{ d.endTime }}</span>
                  <span class="demand-count">
                    区间 {{ d.totalNeeded }} 人·次（{{ d.dayCount }} 天，均 {{ d.avgNeeded }} 人/日）
                  </span>
                </div>
              </div>
              <el-empty v-else description="请先在班次需求配置中设置当前月份人数" :image-size="48" />
            </el-form-item>
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

.emp-picker {
  width: 100%;
}

.emp-picker .el-checkbox {
  margin-bottom: 8px;
}

.demand-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.demand-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 13px;
}

.shift-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.demand-count {
  margin-left: auto;
  font-weight: 600;
  color: var(--app-primary);
}
</style>
