<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  EMPLOYEE_POSITION_OPTIONS,
  isUnassignedDepartment,
} from '@/constants/department'
import { getDepartmentName } from '@/utils'

const props = defineProps<{
  visible: boolean
  employeeIds: string[]
  /** 分配时要求填写人员 ID（待入驻分配/审批） */
  requireEmployeeNo?: boolean
  title?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  assigned: [count: number]
}>()

const store = useAppStore()

const departmentId = ref('')
const position = ref('')
const employeeNo = ref('')

const assignableDepartments = computed(() =>
  store.departments.filter((d) => !isUnassignedDepartment(d.id) && d.orgType !== 'enterprise'),
)

const selectedEmployees = computed(() =>
  props.employeeIds
    .map((id) => store.employees.find((e) => e.id === id))
    .filter(Boolean),
)

const preferredDepartmentId = computed(() => {
  const first = selectedEmployees.value[0]
  return first?.applyDepartmentId || ''
})

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    departmentId.value = preferredDepartmentId.value || ''
    position.value = ''
    employeeNo.value =
      props.employeeIds.length === 1 ? selectedEmployees.value[0]?.employeeNo || '' : ''
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
  if (props.requireEmployeeNo && !employeeNo.value.trim()) {
    ElMessage.warning('请填写人员 ID')
    return
  }
  if (props.requireEmployeeNo && props.employeeIds.length > 1) {
    ElMessage.warning('审批入驻请逐个分配人员 ID')
    return
  }

  try {
    if (props.requireEmployeeNo && props.employeeIds.length === 1) {
      store.assignPendingOnboardEmployee(props.employeeIds[0], {
        departmentId: departmentId.value,
        position: position.value,
        employeeNo: employeeNo.value,
      })
    } else {
      store.batchAssignEmployees(props.employeeIds, departmentId.value, position.value, {
        employeeNo: employeeNo.value.trim() || undefined,
      })
    }
    ElMessage.success(
      props.requireEmployeeNo ? '已审批入驻并分配岗位' : `已为 ${props.employeeIds.length} 名人员分配部门和岗位`,
    )
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
    :title="title || '批量分配部门及岗位'"
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
    <p v-if="preferredDepartmentId" class="dialog-tip preferred">
      申请部门：{{ getDepartmentName(store.departments, preferredDepartmentId) }}
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
      <el-form-item v-if="requireEmployeeNo || employeeIds.length === 1" label="人员 ID" :required="requireEmployeeNo">
        <el-input v-model="employeeNo" placeholder="可编辑的人员 ID" maxlength="32" />
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
  margin: 0 0 12px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
}

.dialog-tip.preferred {
  color: #2563eb;
}
</style>
