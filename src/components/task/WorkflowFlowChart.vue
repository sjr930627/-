<script setup lang="ts">
import { computed } from 'vue'
import type { TaskWorkflow, WorkflowNode } from '@/types'
import { workflowRoleMap } from '@/constants/task'

const props = defineProps<{
  workflow: TaskWorkflow | { nodes: WorkflowNode[] }
  currentNodeId?: string
}>()

const sortedNodes = computed(() =>
  [...props.workflow.nodes].sort((a, b) => a.sort - b.sort),
)
</script>

<template>
  <div class="flow-chart">
    <div
      v-for="(node, index) in sortedNodes"
      :key="node.id"
      class="flow-row"
    >
      <div class="lane-label">{{ workflowRoleMap[node.role] }}</div>
      <div class="flow-track">
        <div
          class="flow-node"
          :class="{
            start: node.nodeType === 'start',
            end: node.nodeType === 'end',
            active: currentNodeId === node.id,
            settlement: node.triggerSettlement,
          }"
        >
          <div class="node-name">{{ node.name }}</div>
          <div class="node-meta">
            <el-tag size="small" type="info">{{ workflowRoleMap[node.role] }}</el-tag>
            <el-tag v-if="node.triggerSettlement" size="small" type="success">触发结算</el-tag>
          </div>
        </div>
        <div v-if="index < sortedNodes.length - 1" class="flow-arrow">
          <el-icon><ArrowRight /></el-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}

.flow-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lane-label {
  width: 88px;
  flex-shrink: 0;
  font-size: 12px;
  color: #909399;
  text-align: right;
}

.flow-track {
  display: flex;
  align-items: center;
  flex: 1;
  overflow-x: auto;
}

.flow-node {
  min-width: 120px;
  padding: 12px 16px;
  border-radius: 8px;
  border: 2px solid #dcdfe6;
  background: #fafafa;
  text-align: center;
}

.flow-node.start {
  border-color: #409eff;
  background: #ecf5ff;
}

.flow-node.end {
  border-color: #67c23a;
  background: #f0f9eb;
}

.flow-node.active {
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.25);
}

.flow-node.settlement.end {
  border-color: #e6a23c;
  background: #fdf6ec;
}

.node-name {
  font-weight: 600;
  margin-bottom: 6px;
}

.node-meta {
  display: flex;
  gap: 4px;
  justify-content: center;
  flex-wrap: wrap;
}

.flow-arrow {
  padding: 0 8px;
  color: #c0c4cc;
  flex-shrink: 0;
}
</style>
