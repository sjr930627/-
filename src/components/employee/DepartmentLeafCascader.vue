<script setup lang="ts">
import { computed } from 'vue'
import type { Department } from '@/types'
import { buildDepartmentCascaderOptions } from '@/utils'
import {
  isEnterpriseRootDepartment,
  isUnassignedDepartment,
} from '@/constants/department'

const props = withDefaults(
  defineProps<{
    modelValue?: string | string[]
    departments: Department[]
    placeholder?: string
    clearable?: boolean
    disabled?: boolean
    /** 多选叶子部门 */
    multiple?: boolean
    collapseTags?: boolean
    leafOnly?: boolean
    /** 任意级可选（非仅叶子），配合 checkStrictly */
    checkStrictly?: boolean
    /** 排除待入驻 / 企业根（默认排除） */
    excludeSystem?: boolean
    /** 编辑时允许保留的非叶子部门 ID */
    allowIds?: string[]
  }>(),
  {
    modelValue: '',
    placeholder: '请按级联选择叶子部门',
    clearable: true,
    disabled: false,
    multiple: false,
    collapseTags: true,
    leafOnly: true,
    checkStrictly: false,
    excludeSystem: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

const options = computed(() =>
  buildDepartmentCascaderOptions(props.departments, {
    leafOnly: props.leafOnly,
    allowIds: props.allowIds,
    exclude: props.excludeSystem
      ? (d) => isUnassignedDepartment(d.id) || isEnterpriseRootDepartment(d)
      : undefined,
  }),
)

const cascaderProps = computed(() => ({
  checkStrictly: props.checkStrictly || !props.leafOnly,
  emitPath: false,
  expandTrigger: 'click' as const,
  multiple: props.multiple,
}))

const innerValue = computed({
  get: () => {
    if (props.multiple) {
      return Array.isArray(props.modelValue) ? props.modelValue : []
    }
    if (Array.isArray(props.modelValue)) return props.modelValue[0] || undefined
    return props.modelValue || undefined
  },
  set: (v: string | string[] | null | undefined) => {
    if (props.multiple) {
      emit('update:modelValue', Array.isArray(v) ? v : v ? [v] : [])
      return
    }
    emit('update:modelValue', Array.isArray(v) ? v[0] || '' : v || '')
  },
})
</script>

<template>
  <el-cascader
    v-model="innerValue"
    class="dept-leaf-cascader"
    :options="options"
    :props="cascaderProps"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    :collapse-tags="multiple && collapseTags"
    :collapse-tags-tooltip="multiple && collapseTags"
    filterable
  />
</template>

<style scoped>
.dept-leaf-cascader {
  width: 100%;
}
</style>
