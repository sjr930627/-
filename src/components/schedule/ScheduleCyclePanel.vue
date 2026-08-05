<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { generateCycleSchedule } from '@/services/schedule'

const props = defineProps<{
  teamId: string
  memberIds: string[]
  dates: string[]
  editMode: boolean
}>()

const emit = defineEmits<{
  enterEdit: []
  applied: [count: number]
}>()

const store = useAppStore()

const cycleForm = ref({
  employeeIds: [] as string[],
  shiftPattern: ['shift_morning', 'shift_morning', 'shift_morning', 'shift_morning', 'shift_morning', 'shift_rest', 'shift_rest'],
  startDate: '',
  days: 7,
})

const weekLabels = ['第1天', '第2天', '第3天', '第4天', '第5天', '第6天', '第7天']

function initForm() {
  cycleForm.value.employeeIds = [...props.memberIds]
  cycleForm.value.startDate = props.dates[0] ?? ''
  cycleForm.value.days = props.dates.length || 7
}

initForm()

function applyCycle() {
  if (!props.editMode) {
    emit('enterEdit')
  }
  if (!cycleForm.value.employeeIds.length) {
    ElMessage.warning('请选择人员')
    return
  }
  if (!cycleForm.value.startDate) {
    ElMessage.warning('请选择起始日期')
    return
  }
  const draft = generateCycleSchedule(
    cycleForm.value.employeeIds,
    cycleForm.value.shiftPattern,
    cycleForm.value.startDate,
    cycleForm.value.days,
    props.teamId,
  )
  draft.forEach((item) => {
    store.upsertAssignment({
      ...item,
      published: false,
      manualEdited: true,
    })
  })
  emit('applied', draft.length)
  ElMessage.success(`已按周期生成 ${draft.length} 条排班`)
}
</script>

<template>
  <div class="cycle-panel page-card">
    <h3 class="panel-title">按周期排班</h3>
    <p class="text-muted desc">为选中人员按 N 天循环班次模式批量生成排班，周末与工作日均可排班。</p>
    <el-form label-width="100px" class="cycle-form">
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
      <el-form-item>
        <el-button type="primary" @click="applyCycle">生成排班</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.cycle-panel {
  padding: 20px 24px;
}

.panel-title {
  margin: 0 0 8px;
  font-size: 16px;
}

.desc {
  margin: 0 0 20px;
  font-size: 13px;
}

.cycle-form {
  max-width: 560px;
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
</style>
