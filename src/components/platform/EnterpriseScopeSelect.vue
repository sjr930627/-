<script setup lang="ts">
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'

withDefaults(
  defineProps<{
    modelValue: string
    mode?: 'switch' | 'filter'
    size?: 'default' | 'small' | 'large'
    width?: string
  }>(),
  {
    mode: 'filter',
    size: 'default',
    width: '220px',
  },
)

defineEmits<{
  'update:modelValue': [value: string]
}>()

const { enterpriseOptions } = useEnterpriseScope('filter')
</script>

<template>
  <el-select
    :model-value="modelValue"
    :size="size"
    :style="{ width }"
    :placeholder="mode === 'switch' ? '选择企业' : '全部企业'"
    :clearable="mode === 'filter'"
    @update:model-value="$emit('update:modelValue', $event ?? (mode === 'filter' ? 'all' : modelValue))"
  >
    <el-option v-if="mode === 'filter'" label="全部企业" value="all" />
    <el-option
      v-for="ent in enterpriseOptions"
      :key="ent.id"
      :label="ent.name"
      :value="ent.id"
    />
  </el-select>
</template>
