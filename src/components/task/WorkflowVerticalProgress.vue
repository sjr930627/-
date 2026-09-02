<script setup lang="ts">
import { computed } from 'vue'
import { Check, Close } from '@element-plus/icons-vue'
import type { TaskWorkflow } from '@/types'
import { resolveInstanceWorkflowStatus } from '@/services/task'
import { sortedWorkflowNodes } from '@/utils/workflow'

const props = defineProps<{
  workflow: TaskWorkflow
  currentNodeId: string
  currentNodeName?: string
}>()

const steps = computed(() => {
  const sorted = sortedWorkflowNodes(props.workflow.nodes)
  const cancelEnd = sorted.find(
    (n) => n.nodeType === 'end' && (n.name.includes('取消') || n.name.includes('关闭')),
  )
  const mainNodes = sorted.filter(
    (n) => n.id !== cancelEnd?.id && !(n.nodeType === 'end' && n.name.includes('取消')),
  )

  const workflowStatus = resolveInstanceWorkflowStatus(
    { currentNodeId: props.currentNodeId, currentNodeName: props.currentNodeName ?? '' },
    props.workflow,
  )

  if (workflowStatus === 'cancelled') {
    const cancelStep = cancelEnd ?? {
      id: props.currentNodeId,
      name: props.currentNodeName?.includes('取消') ? props.currentNodeName : '已取消',
    }
    return [
      ...mainNodes.map((node) => ({
        id: node.id,
        name: node.name,
        status: 'completed' as const,
      })),
      {
        id: cancelStep.id,
        name: cancelStep.name,
        status: 'cancelled' as const,
      },
    ]
  }

  const currentIdx = mainNodes.findIndex((n) => n.id === props.currentNodeId)
  const resolvedIdx =
    workflowStatus === 'completed'
      ? mainNodes.length - 1
      : currentIdx >= 0
        ? currentIdx
        : mainNodes.length - 1

  return mainNodes.map((node, index) => ({
    id: node.id,
    name: node.name,
    status:
      workflowStatus === 'completed' || index < resolvedIdx
        ? ('completed' as const)
        : index === resolvedIdx
          ? ('current' as const)
          : ('pending' as const),
  }))
})
</script>

<template>
  <div class="vertical-progress">
    <div
      v-for="(step, index) in steps"
      :key="step.id"
      class="step-row"
      :class="step.status"
    >
      <div class="step-track">
        <div class="step-node">
          <el-icon v-if="step.status === 'completed'" :size="14"><Check /></el-icon>
          <el-icon v-else-if="step.status === 'cancelled'" :size="14"><Close /></el-icon>
          <span v-else-if="step.status === 'current'" class="current-dot" />
        </div>
        <div v-if="index < steps.length - 1" class="step-line" :class="step.status" />
      </div>
      <div class="step-body">
        <div class="step-name">{{ step.name }}</div>
        <el-tag v-if="step.status === 'current'" size="small" type="primary">当前</el-tag>
        <el-tag v-else-if="step.status === 'completed'" size="small" type="success">已完成</el-tag>
        <el-tag v-else-if="step.status === 'cancelled'" size="small" type="info">已取消</el-tag>
      </div>
    </div>
    <div class="flow-legend">
      <span><i class="dot done" /> 已完成</span>
      <span><i class="dot current" /> 当前节点</span>
      <span><i class="dot pending" /> 待执行</span>
      <span><i class="dot cancelled" /> 已取消</span>
    </div>
  </div>
</template>

<style scoped>
.vertical-progress {
  padding: 4px 0;
}

.step-row {
  display: flex;
  gap: 12px;
  min-height: 52px;
}

.step-row:last-child {
  min-height: auto;
}

.step-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 28px;
  flex-shrink: 0;
}

.step-node {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 2px solid #dcdfe6;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  z-index: 1;
}

.step-row.completed .step-node {
  border-color: #67c23a;
  background: #f0f9eb;
  color: #67c23a;
}

.step-row.current .step-node {
  border-color: #409eff;
  background: #ecf5ff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.2);
}

.step-row.cancelled .step-node {
  border-color: #909399;
  background: #f4f4f5;
  color: #909399;
}

.current-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #409eff;
}

.step-line {
  flex: 1;
  width: 2px;
  min-height: 20px;
  margin: 4px 0;
  background: #e4e7ed;
}

.step-line.completed,
.step-line.cancelled {
  background: #67c23a;
}

.step-line.current {
  background: linear-gradient(to bottom, #409eff, #e4e7ed);
}

.step-body {
  flex: 1;
  padding-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.step-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.step-row.pending .step-name,
.step-row.cancelled .step-name {
  color: #909399;
}

.flow-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
  font-size: 12px;
  color: #909399;
}

.flow-legend .dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.flow-legend .dot.done {
  background: #67c23a;
}

.flow-legend .dot.current {
  background: #409eff;
}

.flow-legend .dot.pending {
  background: #dcdfe6;
}

.flow-legend .dot.cancelled {
  background: #909399;
}
</style>
