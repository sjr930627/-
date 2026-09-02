<script setup lang="ts">
import { computed, watch } from 'vue'
import {
  workflowNodeActionOptions,
  workflowActionMap,
  workflowNodeTypeMap,
  workflowPrerequisiteMap,
  workflowRoleMap,
} from '@/constants/task'
import type { WorkflowAction, WorkflowNode, WorkflowPrerequisite, WorkflowRole } from '@/types'
import {
  getActionConfig,
  getDefaultNextNodeId,
  nodeHasAction,
  toggleNodeAction,
} from '@/utils/workflow'

const props = defineProps<{
  node: WorkflowNode
  index: number
  total: number
  allNodes: WorkflowNode[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  move: [direction: -1 | 1]
  remove: []
}>()

const prerequisiteOptions = Object.entries(workflowPrerequisiteMap) as [WorkflowPrerequisite, string][]
const roleOptions = Object.entries(workflowRoleMap) as [WorkflowRole, string][]

const nodeTypeLabel = computed(() => workflowNodeTypeMap[props.node.nodeType])
const isEndNode = computed(() => props.node.nodeType === 'end')

const routeTargetOptions = computed(() =>
  props.allNodes
    .filter((n) => n.id !== props.node.id && n.name.trim())
    .map((n) => ({
      value: n.id,
      label: n.nodeType === 'end' ? `${n.name}（结束）` : n.name,
    })),
)

const timeoutTargetOptions = computed(() => routeTargetOptions.value)

const showDefaultNext = computed(
  () => !isEndNode.value && props.node.role === 'system' && props.node.actions.length === 0,
)

watch(
  () => props.node.nodeType,
  (type) => {
    if (type === 'end') {
      props.node.actions = []
      props.node.timeoutEnabled = false
      props.node.timeoutHours = undefined
      props.node.timeoutTargetNodeId = undefined
      props.node.triggerSettlement = true
    } else {
      props.node.triggerSettlement = false
    }
  },
)

function togglePrerequisite(key: WorkflowPrerequisite) {
  if (props.readonly) return
  const list = props.node.prerequisites ?? (props.node.prerequisites = [])
  const idx = list.indexOf(key)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(key)
}

function hasPrerequisite(key: WorkflowPrerequisite) {
  return props.node.prerequisites?.includes(key) ?? false
}

function toggleNotifyRole(role: WorkflowRole) {
  if (props.readonly) return
  const list = props.node.notifyRoles ?? (props.node.notifyRoles = [])
  const idx = list.indexOf(role)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(role)
}

function hasNotifyRole(role: WorkflowRole) {
  return props.node.notifyRoles?.includes(role) ?? false
}

function onToggleAction(action: WorkflowAction) {
  if (props.readonly || isEndNode.value) return
  toggleNodeAction(props.node, action, props.allNodes)
}

function actionTarget(action: WorkflowAction) {
  const config = getActionConfig(props.node, action)
  if (!config) return undefined
  if (!config.targetNodeId) {
    config.targetNodeId = getDefaultNextNodeId(props.node, props.allNodes)
  }
  return config.targetNodeId
}

function setActionTarget(action: WorkflowAction, targetNodeId: string | undefined) {
  const config = getActionConfig(props.node, action)
  if (config) config.targetNodeId = targetNodeId
}
</script>

<template>
  <div class="node-card" :class="{ readonly, 'is-end': isEndNode }">
    <div class="node-card-header">
      <div class="node-title">
        <span class="node-index">节点 {{ index + 1 }}</span>
        <el-tag size="small" :type="node.nodeType === 'start' ? 'primary' : node.nodeType === 'end' ? 'success' : 'warning'">
          {{ nodeTypeLabel }}
        </el-tag>
        <el-tag v-if="node.triggerSettlement" size="small" type="warning">关联结算</el-tag>
        <el-tag v-if="!isEndNode && node.actions.length > 1" size="small" type="danger">分叉节点</el-tag>
      </div>
      <div v-if="!readonly" class="node-actions">
        <el-button size="small" text :disabled="index === 0" @click="emit('move', -1)">上移</el-button>
        <el-button size="small" text :disabled="index === total - 1" @click="emit('move', 1)">下移</el-button>
        <el-button size="small" text type="danger" @click="emit('remove')">删除</el-button>
      </div>
    </div>

    <el-row :gutter="12">
      <el-col :span="8">
        <el-form-item label="节点名称" label-width="80px">
          <el-input v-model="node.name" :disabled="readonly" placeholder="如：待领取" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="节点类型" label-width="80px">
          <el-select v-model="node.nodeType" :disabled="readonly" style="width: 100%">
            <el-option v-for="(label, key) in workflowNodeTypeMap" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="执行角色" label-width="80px">
          <el-select v-model="node.role" :disabled="readonly || isEndNode" style="width: 100%">
            <el-option v-for="[key, label] in roleOptions" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
      </el-col>
    </el-row>

    <template v-if="isEndNode">
      <el-alert type="info" :closable="false" show-icon class="end-node-tip">
        结束节点无可执行动作，由上游动作或超时规则流转进入
      </el-alert>
    </template>
    <template v-else>
      <el-form-item label="可执行动作" label-width="80px">
        <div class="action-routes">
          <div v-for="action in workflowNodeActionOptions" :key="action" class="action-route-row">
            <el-checkbox
              :model-value="nodeHasAction(node, action)"
              :disabled="readonly"
              @change="onToggleAction(action)"
            >
              {{ workflowActionMap[action] }}
            </el-checkbox>
            <template v-if="nodeHasAction(node, action)">
              <span class="route-label">流转至</span>
              <el-select
                :model-value="actionTarget(action)"
                :disabled="readonly"
                placeholder="目标节点"
                style="width: 180px"
                @update:model-value="setActionTarget(action, $event)"
              >
                <el-option v-for="opt in routeTargetOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </template>
          </div>
        </div>
      </el-form-item>

      <el-form-item v-if="showDefaultNext" label="默认流转" label-width="80px">
        <el-select
          v-model="node.defaultNextNodeId"
          :disabled="readonly"
          placeholder="无动作时自动流转至"
          style="width: 220px"
          clearable
        >
          <el-option v-for="opt in routeTargetOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>
    </template>

    <template v-if="!isEndNode">
      <el-form-item label="前置条件" label-width="80px">
        <el-checkbox
          v-for="[key, label] in prerequisiteOptions"
          :key="key"
          :model-value="hasPrerequisite(key)"
          :disabled="readonly"
          @change="togglePrerequisite(key)"
        >
          {{ label }}
        </el-checkbox>
        <el-input
          v-if="hasPrerequisite('time_condition')"
          v-model="node.timeConditionNote"
          :disabled="readonly"
          placeholder="时间条件说明，如：工作日 9:00-18:00"
          style="width: 280px; margin-left: 12px"
        />
      </el-form-item>

      <el-form-item label="通知方式" label-width="80px">
        <el-checkbox v-model="node.notifySms" :disabled="readonly">短信</el-checkbox>
        <el-checkbox v-model="node.notifyMiniProgram" :disabled="readonly">小程序</el-checkbox>
      </el-form-item>

      <el-form-item label="通知角色" label-width="80px">
        <el-checkbox
          v-for="[key, label] in roleOptions.filter(([k]) => k !== 'system')"
          :key="key"
          :model-value="hasNotifyRole(key)"
          :disabled="readonly"
          @change="toggleNotifyRole(key)"
        >
          {{ label }}
        </el-checkbox>
      </el-form-item>

      <el-form-item label="超时规则" label-width="80px">
        <el-radio-group v-model="node.timeoutEnabled" :disabled="readonly">
          <el-radio :value="false">无</el-radio>
          <el-radio :value="true">有</el-radio>
        </el-radio-group>
        <template v-if="node.timeoutEnabled">
          <span class="timeout-text">超过</span>
          <el-input-number
            v-model="node.timeoutHours"
            :min="1"
            :max="720"
            :disabled="readonly"
            controls-position="right"
            style="width: 110px"
          />
          <span class="timeout-text">小时后流转至</span>
          <el-select
            v-model="node.timeoutTargetNodeId"
            :disabled="readonly"
            placeholder="选择目标节点"
            style="width: 160px"
            clearable
          >
            <el-option v-for="opt in timeoutTargetOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </template>
      </el-form-item>
    </template>

    <el-form-item v-if="isEndNode" label="关联结算" label-width="80px">
      <span class="settlement-tip">终止节点默认触发结算</span>
    </el-form-item>
  </div>
</template>

<style scoped>
.node-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px 16px 4px;
  margin-bottom: 12px;
  background: #fafafa;
}

.node-card.is-end {
  background: #f0f9eb;
  border-color: #c2e7b0;
}

.node-card.readonly {
  background: #f5f7fa;
}

.node-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.node-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.node-index {
  font-weight: 600;
}

.node-actions {
  display: flex;
  gap: 4px;
}

.action-routes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.action-route-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.route-label {
  color: #909399;
  font-size: 13px;
}

.end-node-tip {
  margin-bottom: 12px;
}

.timeout-text {
  margin: 0 8px;
  color: #606266;
  font-size: 13px;
}

.settlement-tip {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}
</style>
