<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { getDepartmentName } from '@/utils'
import { enterpriseOperatorRoleId } from '@/constants/enterprise'
import { accountHasRole } from '@/constants/account'
import EnterpriseOwnerPicker from '@/components/enterprise/EnterpriseOwnerPicker.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    placeholder?: string
  }>(),
  {
    placeholder: '部门树多选或搜索企业负责人',
  },
)

const emit = defineEmits<{
  'update:modelValue': [string[]]
}>()

const store = useAppStore()
const pickerVisible = ref(false)

const selectedOwners = computed(() =>
  props.modelValue
    .map((id) => store.systemAccounts.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a)),
)

const operatorOptions = computed(() =>
  store.systemAccounts
    .filter((a) => accountHasRole(a, enterpriseOperatorRoleId) && a.status === 'enabled')
    .map((a) => ({
      id: a.id,
      label: `${a.displayName}（${getDepartmentName(store.departments, a.departmentId)}）`,
      searchText: `${a.displayName} ${a.username} ${a.phone ?? ''}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')),
)

function onSelectChange(ids: string[]) {
  emit('update:modelValue', ids)
}

function openPicker() {
  pickerVisible.value = true
}

function clearAll() {
  emit('update:modelValue', [])
}
</script>

<template>
  <div class="owner-filter">
    <el-select
      :model-value="modelValue"
      multiple
      filterable
      collapse-tags
      collapse-tags-tooltip
      clearable
      :placeholder="placeholder"
      class="owner-select"
      @update:model-value="onSelectChange"
    >
      <el-option
        v-for="opt in operatorOptions"
        :key="opt.id"
        :label="opt.label"
        :value="opt.id"
      >
        <span>{{ opt.label }}</span>
      </el-option>
    </el-select>
    <el-button @click="openPicker">部门树</el-button>

    <el-dialog
      v-model="pickerVisible"
      title="按权限部门选择企业负责人"
      width="720px"
      destroy-on-close
      append-to-body
    >
      <p class="dialog-tip text-muted">
        左侧选择权限部门树，右侧勾选账号（支持多选）；也可在右侧输入姓名/账号/手机查询。
      </p>
      <EnterpriseOwnerPicker :model-value="modelValue" @update:model-value="onSelectChange" />
      <template #footer>
        <el-button @click="clearAll">清空</el-button>
        <el-button type="primary" @click="pickerVisible = false">
          确定{{ selectedOwners.length ? `（已选 ${selectedOwners.length}）` : '' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.owner-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.owner-select {
  flex: 1;
  min-width: 0;
}

.dialog-tip {
  margin: 0 0 12px;
  font-size: 13px;
}
</style>
