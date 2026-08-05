<script setup lang="ts">
import { computed } from 'vue'
import type { TaskWorkflow, WorkflowNode } from '@/types'
import { workflowRoleMap } from '@/constants/task'
import { buildWorkflowFlowEdges, sortedWorkflowNodes } from '@/utils/workflow'

const props = withDefaults(
  defineProps<{
    workflow: TaskWorkflow | { nodes: WorkflowNode[] }
    currentNodeId?: string
    compact?: boolean
  }>(),
  { compact: false },
)

const sortedNodes = computed(() => sortedWorkflowNodes(props.workflow.nodes))
const edges = computed(() => buildWorkflowFlowEdges(props.workflow.nodes))

const nodeMap = computed(() => new Map(sortedNodes.value.map((n) => [n.id, n])))

const mainPathNodeIds = computed(() => {
  const ids = new Set<string>()
  const start = sortedNodes.value.find((n) => n.nodeType === 'start')
  if (!start) return ids

  let current: WorkflowNode | undefined = start
  const visited = new Set<string>()
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    ids.add(current.id)
    if (current.nodeType === 'end') break
    const defaultEdge = edges.value.find((e) => e.from === current!.id && !e.isBranch)
    if (!defaultEdge) break
    current = nodeMap.value.get(defaultEdge.to)
  }
  return ids
})

const branchEdges = computed(() => edges.value.filter((e) => e.isBranch))
</script>

<template>
  <div class="flow-chart" :class="{ compact }">
    <template v-if="compact">
      <div class="compact-track">
        <template v-for="(node, index) in sortedNodes" :key="node.id">
          <div
            class="compact-node"
            :class="{
              start: node.nodeType === 'start',
              middle: node.nodeType === 'middle',
              end: node.nodeType === 'end',
              active: currentNodeId === node.id,
              settlement: node.triggerSettlement,
              'off-main': !mainPathNodeIds.has(node.id),
            }"
          >
            <div class="node-name">{{ node.name }}</div>
            <div class="node-meta">
              <el-tag size="small" type="info">{{ workflowRoleMap[node.role] }}</el-tag>
              <el-tag v-if="node.triggerSettlement" size="small" type="warning">关联结算</el-tag>
            </div>
          </div>
          <div v-if="index < sortedNodes.length - 1" class="compact-arrow">→</div>
        </template>
      </div>

      <div v-if="branchEdges.length" class="branch-list">
        <div class="branch-title">分叉流转</div>
        <div v-for="(edge, i) in branchEdges" :key="i" class="branch-item">
          <span class="branch-from">{{ nodeMap.get(edge.from)?.name }}</span>
          <span class="branch-action">{{ edge.label }}</span>
          <span class="branch-arrow">→</span>
          <span class="branch-to">{{ nodeMap.get(edge.to)?.name }}</span>
        </div>
      </div>
    </template>
    <template v-else>
      <div v-for="(node, index) in sortedNodes" :key="node.id" class="flow-row">
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
              <el-tag v-if="node.triggerSettlement" size="small" type="success">关联结算</el-tag>
            </div>
          </div>
          <div v-if="index < sortedNodes.length - 1" class="flow-arrow">
            <el-icon><ArrowRight /></el-icon>
          </div>
        </div>
      </div>

      <div v-if="branchEdges.length" class="branch-list">
        <div class="branch-title">分叉流转</div>
        <div v-for="(edge, i) in branchEdges" :key="i" class="branch-item">
          <span class="branch-from">{{ nodeMap.get(edge.from)?.name }}</span>
          <span class="branch-action">{{ edge.label }}</span>
          <span class="branch-arrow">→</span>
          <span class="branch-to">{{ nodeMap.get(edge.to)?.name }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.flow-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
}

.flow-chart.compact {
  padding: 4px 0;
}

.compact-track {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.compact-node {
  min-width: 88px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 2px solid #dcdfe6;
  background: #fafafa;
  text-align: center;
}

.compact-node.start {
  border-color: #409eff;
  background: #ecf5ff;
}

.compact-node.middle {
  border-color: #e6a23c;
  background: #fdf6ec;
}

.compact-node.end {
  border-color: #67c23a;
  background: #f0f9eb;
}

.compact-node.off-main {
  border-style: dashed;
  opacity: 0.85;
}

.compact-node.active {
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.25);
}

.compact-arrow {
  color: #c0c4cc;
  font-size: 18px;
  padding: 0 2px;
}

.branch-list {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #e4e7ed;
}

.branch-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.branch-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.branch-from,
.branch-to {
  color: #303133;
}

.branch-action {
  color: #e6a23c;
  background: #fdf6ec;
  padding: 1px 6px;
  border-radius: 4px;
}

.branch-arrow {
  color: #c0c4cc;
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
  font-size: 13px;
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
