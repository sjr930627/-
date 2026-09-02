<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: number
    unlimited: boolean
    min?: number
    max?: number
    unit?: string
    disabled?: boolean
  }>(),
  { min: 1, max: 99999, unit: '单', disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: number | undefined]
  'update:unlimited': [value: boolean]
}>()

const quantity = computed({
  get: () => props.modelValue,
  set: (v: number | undefined) => emit('update:modelValue', v),
})

const isUnlimited = computed({
  get: () => props.unlimited,
  set: (v: boolean) => emit('update:unlimited', v),
})

function onUnlimitedChange(checked: boolean) {
  isUnlimited.value = checked
  if (checked) {
    quantity.value = undefined
  } else if (quantity.value == null) {
    quantity.value = props.min
  }
}
</script>

<template>
  <div class="task-quantity-field">
    <el-input-number
      v-model="quantity"
      :min="min"
      :max="max"
      :disabled="disabled || isUnlimited"
      controls-position="right"
      placeholder="请输入数量"
      class="quantity-input"
    />
    <span class="unit-label">{{ unit }}</span>
    <el-checkbox
      :model-value="isUnlimited"
      class="unlimited-check"
      :disabled="disabled"
      @change="onUnlimitedChange(!!$event)"
    >
      无上限
    </el-checkbox>
  </div>
</template>

<style scoped>
.task-quantity-field {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.quantity-input {
  width: 160px;
}

.unit-label {
  color: #606266;
  font-size: 14px;
}

.unlimited-check {
  margin-left: 4px;
}
</style>
