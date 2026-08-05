<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { generateCycleSchedule } from '@/services/schedule'
import ScheduleTeamBoard from '@/components/schedule/ScheduleTeamBoard.vue'
import { addDays } from '@/utils'
import type { Employee, ScheduleAssignment } from '@/types'

const props = defineProps<{
  visible: boolean
  teamId: string
  memberIds: string[]
  defaultStartDate: string
  defaultDays: number
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  applied: [count: number]
}>()

const store = useAppStore()

const step = ref<'form' | 'preview'>('form')

const cycleForm = ref({
  employeeIds: [] as string[],
  shiftPattern: [
    'shift_morning',
    'shift_morning',
    'shift_morning',
    'shift_morning',
    'shift_morning',
    'shift_rest',
    'shift_rest',
  ],
  startDate: '',
  days: 7,
})

const weekLabels = ['第1天', '第2天', '第3天', '第4天', '第5天', '第6天', '第7天']

const previewDraft = ref<ReturnType<typeof generateCycleSchedule>>([])

const previewDates = computed(() => {
  if (!cycleForm.value.startDate || !cycleForm.value.days) return []
  return Array.from({ length: cycleForm.value.days }, (_, i) =>
    addDays(cycleForm.value.startDate, i),
  )
})

const previewAssignments = computed(() => {
  const map = new Map<string, ScheduleAssignment>()
  previewDraft.value.forEach((item, idx) => {
    map.set(`${item.employeeId}#${item.date}`, {
      ...item,
      id: `preview_${idx}`,
      published: false,
      manualEdited: true,
    })
  })
  return map
})

const previewGroups = computed(() => {
  const team = store.teams.find((t) => t.id === props.teamId)
  const employees = cycleForm.value.employeeIds
    .map((id) => store.employees.find((e) => e.id === id))
    .filter((e): e is Employee => Boolean(e))
  return [
    {
      teamId: props.teamId,
      teamName: team?.name ?? '班组',
      employees,
    },
  ]
})

function getPreviewAssignment(employeeId: string, date: string) {
  return previewAssignments.value.get(`${employeeId}#${date}`)
}

function resetForm() {
  cycleForm.value.employeeIds = [...props.memberIds]
  cycleForm.value.startDate = props.defaultStartDate
  cycleForm.value.days = props.defaultDays || 7
  step.value = 'form'
  previewDraft.value = []
}

watch(
  () => props.visible,
  (v) => {
    if (v) resetForm()
  },
)

function close() {
  emit('update:visible', false)
}

function goPreview() {
  if (!cycleForm.value.employeeIds.length) {
    ElMessage.warning('请选择人员')
    return
  }
  if (!cycleForm.value.startDate) {
    ElMessage.warning('请选择起始日期')
    return
  }
  previewDraft.value = generateCycleSchedule(
    cycleForm.value.employeeIds,
    cycleForm.value.shiftPattern,
    cycleForm.value.startDate,
    cycleForm.value.days,
    props.teamId,
  )
  step.value = 'preview'
}

function confirmApply() {
  previewDraft.value.forEach((item) => {
    store.upsertAssignment({
      ...item,
      published: false,
      manualEdited: true,
    })
  })
  const count = previewDraft.value.length
  emit('applied', count)
  ElMessage.success(`已应用 ${count} 条周期排班`)
  close()
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="step === 'form' ? '按周期排班' : '预览周期排班'"
    :width="step === 'preview' ? '960px' : '640px'"
    destroy-on-close
    class="cycle-dialog"
    @update:model-value="emit('update:visible', $event)"
  >
    <template v-if="step === 'form'">
      <p class="text-muted desc">为选中人员按 N 天循环班次模式批量生成，确认预览后才会写入排班列表。</p>
      <el-form label-width="100px">
        <el-form-item label="适用人员">
          <el-select v-model="cycleForm.employeeIds" multiple filterable style="width: 100%">
            <el-option
              v-for="id in memberIds"
              :key="id"
              :label="store.employees.find((e) => e.id === id)?.name ?? id"
              :value="id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="起始日期">
          <el-date-picker v-model="cycleForm.startDate" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="排班天数">
          <el-input-number v-model="cycleForm.days" :min="1" :max="62" />
        </el-form-item>
        <el-form-item label="循环模式">
          <div class="pattern-grid">
            <div v-for="(label, idx) in weekLabels" :key="idx" class="pattern-row">
              <span>{{ label }}</span>
              <el-select v-model="cycleForm.shiftPattern[idx]" style="width: 140px">
                <el-option v-for="s in store.shifts" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </div>
          </div>
        </el-form-item>
      </el-form>
    </template>

    <template v-else>
      <p class="text-muted desc">
        预览共 <strong>{{ previewDraft.length }}</strong> 条排班，确认后将写入排班列表（草稿）。
      </p>
      <div class="preview-board-wrap">
        <ScheduleTeamBoard
          :dates="previewDates"
          :groups="previewGroups"
          :shifts="store.shifts"
          edit-mode="readonly"
          :selected-cells="new Set()"
          :conflict-map="new Map()"
          :get-assignment="getPreviewAssignment"
          compact
        />
      </div>
    </template>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button v-if="step === 'preview'" @click="step = 'form'">返回修改</el-button>
      <el-button v-if="step === 'form'" type="primary" @click="goPreview">预览排班</el-button>
      <el-button v-else type="primary" @click="confirmApply">确认应用</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.desc {
  margin: 0 0 16px;
  font-size: 13px;
}

.pattern-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pattern-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #64748b;
}

.preview-board-wrap {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  overflow: hidden;
}

.preview-board-wrap :deep(.team-board-wrap) {
  max-height: 420px;
}
</style>
