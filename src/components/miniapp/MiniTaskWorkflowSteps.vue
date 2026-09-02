<script setup lang="ts">
import { Check } from '@element-plus/icons-vue'
import type { TaskWorkflowStepItem } from '@/services/miniTaskWorkflow'

defineProps<{
  steps: TaskWorkflowStepItem[]
}>()

function lineClass(current: TaskWorkflowStepItem) {
  if (current.status === 'completed') return 'done'
  if (current.status === 'active') return 'active'
  return 'pending'
}
</script>

<template>
  <div class="wf-steps">
    <div
      v-for="(step, idx) in steps"
      :key="step.id"
      class="wf-step"
      :class="[step.status, { last: idx === steps.length - 1 }]"
    >
      <div class="wf-step-track">
        <div class="wf-step-dot">
          <el-icon v-if="step.status === 'completed'" :size="14"><Check /></el-icon>
          <span v-else>{{ step.index }}</span>
        </div>
        <div v-if="idx < steps.length - 1" class="wf-step-line" :class="lineClass(step)" />
      </div>
      <div class="wf-step-body">
        <div class="wf-step-title">{{ step.title }}</div>
        <div v-if="step.description" class="wf-step-desc">{{ step.description }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wf-steps {
  padding: 4px 0;
}

.wf-step {
  display: flex;
  gap: 12px;
  min-height: 56px;
}

.wf-step.last {
  min-height: auto;
}

.wf-step-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 28px;
  flex-shrink: 0;
}

.wf-step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  z-index: 1;
}

.wf-step-line {
  flex: 1;
  width: 2px;
  min-height: 24px;
  margin: 4px 0;
  border-radius: 1px;
}

.wf-step-line.done {
  background: #22c55e;
}

.wf-step-line.active {
  background: linear-gradient(to bottom, #4FD1C5 0%, #CCFBF1 100%);
}

.wf-step-line.pending {
  background: #e5e7eb;
}

.wf-step.completed .wf-step-dot {
  background: #22c55e;
  color: #fff;
  border: none;
}

.wf-step.active .wf-step-dot {
  background: #4FD1C5;
  color: #fff;
  box-shadow: 0 0 0 4px rgba(79, 209, 197, 0.15);
}

.wf-step.pending .wf-step-dot {
  background: #f3f4f6;
  color: #9ca3af;
  border: 1px solid #e5e7eb;
}

.wf-step-body {
  flex: 1;
  padding-bottom: 20px;
  min-width: 0;
}

.wf-step.last .wf-step-body {
  padding-bottom: 0;
}

.wf-step-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 28px;
  color: #9ca3af;
}

.wf-step.completed .wf-step-title {
  color: #22c55e;
  font-weight: 600;
}

.wf-step.active .wf-step-title {
  color: #1d4ed8;
  font-weight: 700;
}

.wf-step-desc {
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.5;
  color: #9ca3af;
}

.wf-step.completed .wf-step-desc {
  color: #6b7280;
}

.wf-step.active .wf-step-desc {
  color: #4b5563;
}
</style>
