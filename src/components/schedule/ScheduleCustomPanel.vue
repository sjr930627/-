<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { FLEX_SHIFT_ID } from '@/constants/schedule'
import { useAppStore } from '@/stores/app'
import { addDays, isWeekend } from '@/utils'

const props = defineProps<{
  teamId: string
  memberIds: string[]
  defaultDateRange: [string, string]
  editMode: boolean
}>()

const emit = defineEmits<{
  enterEdit: []
  applied: [count: number]
}>()

const store = useAppStore()

const form = ref({
  employeeIds: [] as string[],
  dateRange: ['', ''] as [string, string],
  timeRange: ['08:00', '16:00'] as [string, string],
  skipWeekends: false,
  note: '',
})

const previewVisible = ref(false)

const selectedDates = computed(() => {
  const [start, end] = form.value.dateRange
  if (!start || !end) return []
  const dates: string[] = []
  let cur = start
  while (cur <= end) {
    if (!form.value.skipWeekends || !isWeekend(cur)) dates.push(cur)
    cur = addDays(cur, 1)
  }
  return dates
})

const previewCount = computed(() => form.value.employeeIds.length * selectedDates.value.length)

const previewRows = computed(() => {
  const rows: { empName: string; date: string; time: string }[] = []
  const timeLabel = `${form.value.timeRange[0]}-${form.value.timeRange[1]}`
  form.value.employeeIds.forEach((id) => {
    const empName = store.employees.find((e) => e.id === id)?.name ?? id
    selectedDates.value.forEach((date) => {
      rows.push({ empName, date, time: timeLabel })
    })
  })
  return rows
})

function initForm() {
  form.value.employeeIds = [...props.memberIds]
  form.value.dateRange = [...props.defaultDateRange]
}

initForm()

watch(
  () => [props.memberIds, props.defaultDateRange] as const,
  () => initForm(),
  { deep: true },
)

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function validateTimeRange() {
  const [start, end] = form.value.timeRange
  if (!start || !end) return '请选择时间段'
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  if (startMin === endMin) return '开始与结束时间不能相同'
  return null
}

function buildNote() {
  const [start, end] = form.value.timeRange
  const base = `自定义 ${start}-${end}`
  return form.value.note.trim() ? `${base}；${form.value.note.trim()}` : base
}

function applyCustom() {
  if (!props.editMode) emit('enterEdit')
  if (!form.value.employeeIds.length) {
    ElMessage.warning('请选择人员')
    return
  }
  if (!selectedDates.value.length) {
    ElMessage.warning('请选择有效日期范围')
    return
  }
  const timeErr = validateTimeRange()
  if (timeErr) {
    ElMessage.warning(timeErr)
    return
  }
  const note = buildNote()
  let count = 0
  form.value.employeeIds.forEach((employeeId) => {
    selectedDates.value.forEach((date) => {
      store.upsertAssignment({
        employeeId,
        date,
        shiftId: FLEX_SHIFT_ID,
        teamId: props.teamId,
        published: false,
        manualEdited: true,
        note,
      })
      count += 1
    })
  })
  emit('applied', count)
  ElMessage.success(`已为 ${form.value.employeeIds.length} 人、${selectedDates.value.length} 天共写入 ${count} 条自定义排班`)
}

function selectAllEmployees() {
  form.value.employeeIds = [...props.memberIds]
}

function clearEmployees() {
  form.value.employeeIds = []
}
</script>

<template>
  <div class="custom-panel page-card">
    <div class="panel-header">
      <div>
        <h3 class="panel-title">自定义排班</h3>
        <p class="text-muted desc">选择人员、日期范围和时间段，批量写入排班（保存后需发布才通知员工）。</p>
      </div>
      <el-tag v-if="!editMode" type="warning" size="small">只读 · 应用时将自动进入编辑</el-tag>
    </div>

    <el-form label-width="96px" class="custom-form">
      <el-form-item label="选择人员">
        <div class="emp-toolbar">
          <el-button size="small" link type="primary" @click="selectAllEmployees">全选</el-button>
          <el-button size="small" link @click="clearEmployees">清空</el-button>
          <span class="text-muted">已选 {{ form.employeeIds.length }} / {{ memberIds.length }} 人</span>
        </div>
        <el-select
          v-model="form.employeeIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择要排班的人员"
          style="width: 100%"
        >
          <el-option
            v-for="id in memberIds"
            :key="id"
            :label="`${store.employees.find((e) => e.id === id)?.name ?? id}（${store.employees.find((e) => e.id === id)?.employeeNo ?? ''}）`"
            :value="id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="选择日期">
        <el-date-picker
          v-model="form.dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 100%"
        />
        <div class="form-extra">
          <el-checkbox v-model="form.skipWeekends">跳过周末</el-checkbox>
          <span v-if="selectedDates.length" class="text-muted">
            共 {{ selectedDates.length }} 个工作日
          </span>
        </div>
      </el-form-item>

      <el-form-item label="时间段">
        <el-time-picker
          v-model="form.timeRange"
          is-range
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
          format="HH:mm"
          value-format="HH:mm"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="form.note" type="textarea" :rows="2" placeholder="可选，如：临时顶岗、活动支援" />
      </el-form-item>

      <el-form-item label="预览">
        <div class="preview-summary">
          <span>将生成 <strong>{{ previewCount }}</strong> 条排班</span>
          <el-button
            v-if="previewCount"
            link
            type="primary"
            size="small"
            @click="previewVisible = !previewVisible"
          >
            {{ previewVisible ? '收起明细' : '展开明细' }}
          </el-button>
        </div>
        <el-table
          v-if="previewVisible && previewRows.length"
          :data="previewRows.slice(0, 50)"
          border
          stripe
          size="small"
          max-height="240"
          style="width: 100%; margin-top: 8px"
        >
          <el-table-column prop="empName" label="人员" width="100" />
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column prop="time" label="时段" min-width="120" />
        </el-table>
        <p v-if="previewVisible && previewRows.length > 50" class="text-muted more-hint">
          仅展示前 50 条，实际将写入 {{ previewRows.length }} 条
        </p>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :disabled="!previewCount" @click="applyCustom">
          应用自定义排班
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.custom-panel {
  padding: 20px 24px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}

.panel-title {
  margin: 0 0 6px;
  font-size: 16px;
}

.desc {
  margin: 0;
  font-size: 13px;
}

.custom-form {
  max-width: 640px;
  margin-top: 16px;
}

.emp-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.form-extra {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.4;
}

.preview-summary {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-summary strong {
  color: var(--app-primary);
  font-size: 16px;
}

.more-hint {
  margin: 6px 0 0;
  font-size: 12px;
}
</style>
