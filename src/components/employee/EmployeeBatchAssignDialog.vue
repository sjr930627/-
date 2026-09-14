<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { DEFAULT_WORKFORCE_ENTERPRISE_ID } from '@/constants/department'
import { getDepartmentPath } from '@/utils'
import DepartmentLeafCascader from '@/components/employee/DepartmentLeafCascader.vue'

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
const positionId = ref('')
const employeeNo = ref('')

const selectedEmployees = computed(() =>
  props.employeeIds
    .map((id) => store.employees.find((e) => e.id === id))
    .filter(Boolean),
)

const preferredDepartmentId = computed(() => {
  const first = selectedEmployees.value[0]
  return first?.applyDepartmentId || ''
})

const enterpriseId = computed(() => {
  const dept = store.departments.find((d) => d.id === departmentId.value)
  const fromEmp = selectedEmployees.value[0]?.enterpriseId
  return (
    dept?.enterpriseId ||
    fromEmp ||
    store.currentEnterpriseId ||
    DEFAULT_WORKFORCE_ENTERPRISE_ID
  )
})

const enterprisePositions = computed(() => store.getEnterprisePositions(enterpriseId.value))

const selectedPositionName = computed(() => {
  const pos = store.getEnterprisePosition(positionId.value)
  return pos?.profile.positionName || pos?.name || ''
})

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    departmentId.value = preferredDepartmentId.value || ''
    positionId.value = selectedEmployees.value[0]?.positionId || ''
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
  if (!positionId.value || !selectedPositionName.value) {
    ElMessage.warning('请选择岗位')
    return
  }
  if (props.requireEmployeeNo && !employeeNo.value.trim()) {
    ElMessage.warning('请填写人员 ID')
    return
  }
  if (props.requireEmployeeNo && props.employeeIds.length > 1) {
    ElMessage.warning('审批入驻请逐个分配')
    return
  }

  try {
    store.batchAssignEmployees(props.employeeIds, departmentId.value, selectedPositionName.value, {
      employeeNo: employeeNo.value.trim() || undefined,
      positionId: positionId.value,
    })
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
    :title="title || '分配岗位'"
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
      申请部门：{{ getDepartmentPath(store.departments, preferredDepartmentId) }}
    </p>

    <el-form label-position="top">
      <el-form-item label="分配部门" required>
        <DepartmentLeafCascader
          v-model="departmentId"
          :departments="store.departments"
          :allow-ids="departmentId ? [departmentId] : []"
          placeholder="请按级联选择叶子部门"
        />
      </el-form-item>
      <el-form-item label="分配岗位" required>
        <el-select
          v-model="positionId"
          filterable
          placeholder="请选择企业岗位"
          style="width: 100%"
        >
          <el-option
            v-for="p in enterprisePositions"
            :key="p.id"
            :label="p.profile.positionName || p.name"
            :value="p.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="requireEmployeeNo" label="人员 ID" required>
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
