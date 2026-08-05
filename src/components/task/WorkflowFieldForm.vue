<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { WorkflowFieldConfig } from '@/types'

const props = withDefaults(
  defineProps<{
    fields: WorkflowFieldConfig[]
    modelValue?: Record<string, string | number | boolean>
    readonly?: boolean
    labelWidth?: string
  }>(),
  {
    modelValue: () => ({}),
    readonly: false,
    labelWidth: '100px',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string | number | boolean>]
}>()

const form = reactive<Record<string, string | number | boolean>>({})

const visibleFields = computed(() => props.fields.filter((f) => f.name.trim()))

function initForm() {
  for (const field of visibleFields.value) {
    const existing = props.modelValue[field.id]
    if (existing !== undefined) form[field.id] = existing
    else if (field.fieldType === 'switch') form[field.id] = false
    else form[field.id] = ''
  }
}

watch(
  () => [props.fields, props.modelValue] as const,
  () => {
    initForm()
  },
  { immediate: true, deep: true },
)

watch(
  form,
  () => {
    if (props.readonly) return
    emit('update:modelValue', { ...form })
  },
  { deep: true },
)

function fieldProp(field: WorkflowFieldConfig) {
  return field.id
}
</script>

<template>
  <el-form v-if="visibleFields.length" :label-width="labelWidth" class="workflow-field-form">
    <el-form-item
      v-for="field in visibleFields"
      :key="field.id"
      :label="field.name"
      :prop="fieldProp(field)"
      :required="field.required"
    >
      <template v-if="readonly">
        <span class="readonly-value">{{ modelValue[field.id] ?? '-' }}</span>
      </template>

      <template v-else>
        <el-input
          v-if="field.fieldType === 'text'"
          v-model="form[field.id] as string"
          :placeholder="`请输入${field.name}`"
        />

        <el-select
          v-else-if="field.fieldType === 'select'"
          v-model="form[field.id] as string"
          :placeholder="`请选择${field.name}`"
          style="width: 100%"
        >
          <el-option v-for="opt in field.options" :key="opt" :label="opt" :value="opt" />
        </el-select>

        <el-date-picker
          v-else-if="field.fieldType === 'date'"
          v-model="form[field.id] as string"
          type="date"
          value-format="YYYY-MM-DD"
          :placeholder="`请选择${field.name}`"
          style="width: 100%"
        />

        <el-input-number
          v-else-if="field.fieldType === 'amount'"
          v-model="form[field.id] as number"
          :min="0"
          :precision="2"
          :controls="false"
          style="width: 100%"
        />

        <el-input
          v-else-if="field.fieldType === 'textarea'"
          v-model="form[field.id] as string"
          type="textarea"
          :rows="3"
          :placeholder="`请输入${field.name}`"
        />

        <el-switch v-else-if="field.fieldType === 'switch'" v-model="form[field.id] as boolean" />

        <el-upload v-else-if="field.fieldType === 'attachment'" action="#" :auto-upload="false" :limit="1">
          <el-button type="primary" plain>上传附件（演示）</el-button>
        </el-upload>

        <el-input v-else v-model="form[field.id] as string" :placeholder="`请输入${field.name}`" />
      </template>
    </el-form-item>
  </el-form>
</template>

<style scoped>
.workflow-field-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.readonly-value {
  color: #606266;
  line-height: 32px;
}
</style>
