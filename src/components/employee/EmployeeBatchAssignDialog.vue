<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  EMPLOYEE_POSITION_OPTIONS,
  isUnassignedDepartment,
} from '@/constants/department'

const props = defineProps<{
  visible: boolean
  employeeIds: string[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  assigned: [count: number]
}>()

const store = useAppStore()

const departmentId = ref('')
const position = ref('')

const assignableDepartments = computed(() =>
  store.departments.filter((d) => !isUnassignedDepartment(d.id)),
)

const selectedEmployees = computed(() =>
  props.employeeIds
    .map((id) => store.employees.find((e) => e.id === id))
    .filter(Boolean),
)

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    departmentId.value = ''
    position.value = ''
  },
)

function close() {
  emit('update:visible', false)
}

function submit() {
  if (!props.employeeIds.length) {
    ElMessage.warning('请先选择人员')
    return
  }
  if (!departmentId.value) {
    ElMessage.warning('请选择部门')
    return
  }
  if (!position.value.trim()) {
    ElMessage.warning('请选择或填写岗位')
    return
  }

  try {
    store.batchAssignEmployees(props.employeeIds, departmentId.value, position.value)
    ElMessage.success(`已为 ${props.employeeIds.length} 名人员分配部门和岗位`)
    emit('assigned', props.employeeIds.length)
    close()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '分配失败')
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="批量分配部门及岗位"
    width="480px"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <p class="dialog-tip">
      已选择 <strong>{{ employeeIds.length }}</strong> 名人员
      <template v-if="selectedEmployees.length">
        ：{{ selectedEmployees.map((e) => e!.name).join('、') }}
      </template>
    </p>

    <el-form label-position="top">
      <el-form-item label="分配部门" required>
        <el-select v-model="departmentId" placeholder="请选择部门" filterable style="width: 100%">
          <el-option
            v-for="d in assignableDepartments"
            :key="d.id"
            :label="d.name"
            :value="d.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="分配岗位" required>
        <el-select
          v-model="position"
          filterable
          allow-create
          default-first-option
          placeholder="请选择或输入岗位"
          style="width: 100%"
        >
          <el-option v-for="p in EMPLOYEE_POSITION_OPTIONS" :key="p" :label="p" :value="p" />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" @click="submit">确认分配</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-tip {
  margin: 0 0 16px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
}
</style>
