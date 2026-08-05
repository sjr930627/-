<script setup lang="ts">
import { MINIAPP_TIME_PREF_ROWS, type PartTimeTriChoice } from '@/constants/miniappAuth'
import type { WorkerPartTimePreference } from '@/types'

const model = defineModel<Partial<WorkerPartTimePreference>>({ required: true })

const rows = MINIAPP_TIME_PREF_ROWS

function pick(
  key: (typeof rows)[number]['key'],
  value: PartTimeTriChoice,
) {
  model.value = { ...model.value, [key]: value }
}

function isActive(key: (typeof rows)[number]['key'], value: PartTimeTriChoice) {
  const current = model.value[key]
  return (current ?? 'both') === value
}
</script>

<template>
  <div class="time-pref-picker">
    <div v-for="row in rows" :key="row.key" class="pref-row">
      <button
        type="button"
        class="pref-option"
        :class="{ active: isActive(row.key, 'left') }"
        @click="pick(row.key, 'left')"
      >
        <span class="pref-icon">{{ row.left.icon }}</span>
        <span class="pref-label">{{ row.left.label }}</span>
      </button>
      <button
        type="button"
        class="pref-option"
        :class="{ active: isActive(row.key, 'both') }"
        @click="pick(row.key, 'both')"
      >
        <span class="pref-icon">{{ row.both.icon }}</span>
        <span class="pref-label">{{ row.both.label }}</span>
      </button>
      <button
        type="button"
        class="pref-option"
        :class="{ active: isActive(row.key, 'right') }"
        @click="pick(row.key, 'right')"
      >
        <span class="pref-icon">{{ row.right.icon }}</span>
        <span class="pref-label">{{ row.right.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.time-pref-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pref-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 4px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
}

.pref-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 72px;
  padding: 10px 6px;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}

.pref-option.active {
  background: #f0fdf4;
  box-shadow: inset 0 0 0 1.5px #86efac;
}

.pref-icon {
  font-size: 22px;
  line-height: 1;
}

.pref-label {
  font-size: 12px;
  color: #64748b;
  text-align: center;
  line-height: 1.3;
}

.pref-option.active .pref-label {
  color: #15803d;
  font-weight: 600;
}
</style>
