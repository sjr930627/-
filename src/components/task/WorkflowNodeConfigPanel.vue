<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  workflowActionMap,
  workflowEntryConditionTypeOptions,
  workflowEntryTimeoutActionOptions,
  workflowFieldTypeMap,
  workflowNodeActionOptions,
  workflowPunchCountModeOptions,
  workflowPunchLocationSourceMap,
  workflowPunchMethodMap,
  workflowPunchMethodOptions,
  workflowPunchNavigateModeMap,
  workflowRoleMap,
} from '@/constants/task'
import type {
  WorkflowAction,
  WorkflowActionConfig,
  WorkflowEntryConditionGroup,
  WorkflowEntryConditionType,
  WorkflowFieldConfig,
  WorkflowFieldType,
  WorkflowNode,
  PunchMethod,
  WorkflowPunchNavigateMode,
  WorkflowRole,
} from '@/types'
import {
  createDefaultEntryConditionGroup,
  formatEntryConditionSummary,
  canRemoveWorkflowNode,
  migrateEntryConditionGroup,
  suggestActionTargetNodeId,
} from '@/utils/workflow'
import { generateId } from '@/utils'
import WorkflowFieldPreview from '@/components/task/WorkflowFieldPreview.vue'

const actionTypeOptions = workflowNodeActionOptions.map((action) => ({
  value: action,
  label: workflowActionMap[action],
}))

const props = defineProps<{
  node: WorkflowNode | null
  allNodes: WorkflowNode[]
  workflowFields?: WorkflowFieldConfig[]
  readonly?: boolean
  /** 画布上节点旁的悬浮配置（不含采集字段） */
  floating?: boolean
  /** 右侧固定栏：仅展示该节点的采集字段 */
  fieldsOnly?: boolean
}>()

const emit = defineEmits<{
  close: []
  remove: []
}>()

const canDelete = computed(() => props.node && !props.readonly && !canRemoveWorkflowNode(props.node))

const isFixedStartNode = computed(() => props.node?.nodeType === 'start')

const nodeTypeDesc = computed(() => {
  if (!props.node) return ''
  if (props.node.nodeType === 'start') return '固定为「领取任务」，灵工操作，按钮「确认领取」'
  if (props.node.nodeType === 'end') return '流程终止节点'
  return '配置可见角色、操作按钮与进入条件'
})

const nodeTypeIcon = computed(() => {
  if (!props.node) return '📋'
  if (props.node.nodeType === 'start') return '🟢'
  if (props.node.nodeType === 'end') return '🎯'
  return '📌'
})

const roleOptions = Object.entries(workflowRoleMap) as [WorkflowRole, string][]
const fieldTypeOptions = Object.entries(workflowFieldTypeMap) as [WorkflowFieldType, string][]
const conditionTypeOptions = workflowEntryConditionTypeOptions
const punchNavigateOptions = Object.entries(workflowPunchNavigateModeMap) as [
  WorkflowPunchNavigateMode,
  string,
][]
const punchCountModeOptions = workflowPunchCountModeOptions
const locationSourceOptions = Object.entries(workflowPunchLocationSourceMap)
const timeoutActionOptions = workflowEntryTimeoutActionOptions

const activeGroupIndex = ref(0)
const editingGroupIndex = ref<number | null>(null)

const targetOptions = computed(() =>
  props.allNodes
    .filter((n) => n.id !== props.node?.id && n.name.trim())
    .map((n) => ({
      value: n.id,
      label: n.nodeType === 'end' ? `${n.name}（终止）` : n.name,
    })),
)

const textFieldOptions = computed(() =>
  (props.workflowFields ?? [])
    .filter((f) => f.fieldType === 'text' || f.fieldType === 'textarea')
    .map((f) => ({ value: f.id, label: f.name })),
)

const nodeBoundFields = computed(() => {
  if (!props.node) return []
  return (props.workflowFields ?? []).filter((f) => f.nodeIds.includes(props.node!.id))
})

const isEnterpriseNode = computed(() => props.node?.role === 'enterprise')

const fieldsPreviewHint = computed(() =>
  isEnterpriseNode.value
    ? '流转下一节点时以弹窗展示字段；填写字段名称后下方预览即时更新'
    : '流转下一节点时以弹窗展示字段；若无字段则二次确认。填写名称后下方预览即时更新',
)

function addNodeField() {
  if (!props.node || props.readonly || !props.workflowFields) return
  props.workflowFields.push({
    id: generateId('field'),
    name: '',
    fieldType: 'text',
    required: false,
    nodeIds: [props.node.id],
  })
}

function onFieldTypeChange(field: WorkflowFieldConfig, type: WorkflowFieldType) {
  field.fieldType = type
  if (type === 'select' && (!field.options || !field.options.length)) {
    field.options = ['选项1', '选项2']
  }
  if (type === 'switch') {
    field.required = false
  }
}

function updateSelectOptions(field: WorkflowFieldConfig, raw: string) {
  field.options = raw
    .split(/[,，、\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function selectOptionsText(field: WorkflowFieldConfig) {
  return (field.options ?? []).join('、')
}

function removeNodeField(fieldId: string) {
  if (!props.workflowFields || props.readonly) return
  const index = props.workflowFields.findIndex((f) => f.id === fieldId)
  if (index >= 0) props.workflowFields.splice(index, 1)
}

const entryGroups = computed(() => props.node?.entryConditionGroups ?? [])

const activeGroup = computed(() => entryGroups.value[activeGroupIndex.value] ?? null)

const activeGroupType = computed(() => {
  if (!activeGroup.value) return 'punch_record' as WorkflowEntryConditionType
  const migrated = migrateEntryConditionGroup(activeGroup.value)
  if (migrated.type === 'external_event' || migrated.type === 'field_filled' || migrated.type === 'none') {
    return 'punch_record'
  }
  return migrated.type
})

function onConditionTypeChange(type: WorkflowEntryConditionType) {
  const group = activeGroup.value
  if (!group || props.readonly) return
  group.type = type
  if (type === 'punch_record') {
    group.generatePunchRecord = true
    group.punchNavigateMode = 'jump_to_punch_page'
    group.listenTarget = 'task_executor'
    group.pendingPunchPrompt =
      group.pendingPunchPrompt?.trim() || '进入本节点时，系统自动为执行人生成待打卡记录。'
    group.incompletePrompt = group.incompletePrompt?.trim() || '请先完成打卡'
    if (group.timeoutDays == null) group.timeoutDays = 3
    if (!group.timeoutAction) group.timeoutAction = 'auto_cancel'
    ensureActivePunchRuleDefaults()
  } else if (type === 'time_condition') {
    group.incompletePrompt = group.incompletePrompt?.trim() || '请等待时间条件满足'
    if (group.timeoutDays == null) group.timeoutDays = 3
    if (!group.timeoutAction) group.timeoutAction = 'notify_only'
  }
}

function ensureActivePunchRuleDefaults() {
  const group = activeGroup.value
  if (!group) return
  group.generatePunchRecord = true
  if (!group.punchCountMode || group.punchCountMode === 'each_service_period') {
    group.punchCountMode = 'clock_in_out'
  }
  if (!group.locationSource) group.locationSource = 'task_region'
  group.serviceTimeSource = 'task_schedule'
  group.serviceTimeFieldId = undefined
  const methods = (group.allowedPunchMethods ?? ['gps']).filter(
    (m) => m === 'gps' || m === 'wifi' || m === 'qrcode',
  )
  group.allowedPunchMethods = methods.length ? methods : ['gps']
  if (!group.pendingPunchPrompt?.trim()) {
    group.pendingPunchPrompt = '进入本节点时，系统自动为执行人生成待打卡记录。'
  }
}

function punchMethodEnabled(method: PunchMethod) {
  const list = activeGroup.value?.allowedPunchMethods ?? []
  return list.includes(method)
}

function togglePunchMethod(method: PunchMethod) {
  if (!activeGroup.value || props.readonly) return
  const list = [...(activeGroup.value.allowedPunchMethods ?? ['gps'])]
  const idx = list.indexOf(method)
  if (idx >= 0) {
    if (list.length <= 1) return
    list.splice(idx, 1)
  } else {
    list.push(method)
  }
  activeGroup.value.allowedPunchMethods = list
}

function clearTimeoutDays() {
  if (!activeGroup.value || props.readonly) return
  activeGroup.value.timeoutDays = undefined
}

function onTimeoutActionChange(action: WorkflowEntryConditionGroup['timeoutAction']) {
  const group = activeGroup.value
  if (!group || props.readonly) return
  group.timeoutAction = action
  if (action !== 'auto_advance') {
    group.timeoutTargetNodeId = undefined
  }
}

watch(
  () => activeGroup.value?.id,
  () => {
    if (activeGroup.value && activeGroupType.value === 'punch_record') {
      ensureActivePunchRuleDefaults()
    }
  },
)

const showEntryEditor = computed(
  () => props.node && props.node.nodeType !== 'end' && props.node.nodeType !== 'start',
)

watch(
  () => props.node?.id,
  () => {
    activeGroupIndex.value = 0
    editingGroupIndex.value = null
  },
)

function openGroupEditor(index: number) {
  activeGroupIndex.value = index
  editingGroupIndex.value = index
}

function closeGroupEditor() {
  editingGroupIndex.value = null
}

function targetName(targetNodeId?: string) {
  if (!targetNodeId) return '—'
  return props.allNodes.find((n) => n.id === targetNodeId)?.name ?? '—'
}

function timeoutSummary() {
  if (!props.node?.timeoutEnabled || !props.node.timeoutHours) return '未设置'
  const target = targetName(props.node.timeoutTargetNodeId)
  return `${props.node.timeoutHours} 小时后 → ${target}`
}

function ensureGroups(): WorkflowEntryConditionGroup[] {
  if (!props.node) return []
  if (!props.node.entryConditionGroups) {
    props.node.entryConditionGroups = []
  }
  return props.node.entryConditionGroups
}

function addConditionGroup() {
  if (!props.node || props.readonly) return
  const groups = ensureGroups()
  groups.push(createDefaultEntryConditionGroup())
  const index = groups.length - 1
  activeGroupIndex.value = index
  editingGroupIndex.value = index
}

function removeConditionGroup(index: number) {
  if (!props.node || props.readonly) return
  const groups = ensureGroups()
  groups.splice(index, 1)
  if (activeGroupIndex.value >= groups.length) {
    activeGroupIndex.value = Math.max(0, groups.length - 1)
  }
  if (editingGroupIndex.value === index) {
    editingGroupIndex.value = groups.length ? activeGroupIndex.value : null
  } else if (editingGroupIndex.value !== null && editingGroupIndex.value > index) {
    editingGroupIndex.value -= 1
  }
}

async function confirmRemoveNode() {
  if (!props.node || props.readonly) return
  const err = canRemoveWorkflowNode(props.node)
  if (err) {
    ElMessage.warning(err)
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定删除节点「${props.node.name || '未命名'}」？指向该节点的流转将被清除。`,
      '删除节点',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    emit('remove')
  } catch {
    /* cancelled */
  }
}

function addAction() {
  if (!props.node || props.readonly || props.node.nodeType === 'end' || isFixedStartNode.value) return
  props.node.actions.push({
    action: 'submit',
    label: '',
    targetNodeId: suggestActionTargetNodeId(props.node, 'submit', props.allNodes),
    triggerType: 'manual',
    allowedRoles: [props.node.role],
  })
}

function removeAction(index: number) {
  if (!props.node || props.readonly || isFixedStartNode.value) return
  props.node.actions.splice(index, 1)
}

function onActionTypeChange(action: WorkflowActionConfig, type: WorkflowAction) {
  if (!props.node || props.readonly || isFixedStartNode.value) return
  action.action = type
  if (!action.label?.trim()) {
    action.label = workflowActionMap[type === 'approve' ? 'confirm' : type]
  }
  if (!action.targetNodeId) {
    action.targetNodeId = suggestActionTargetNodeId(props.node, type === 'approve' ? 'confirm' : type, props.allNodes)
  }
}
</script>

<template>
  <div class="config-panel" :class="{ floating, 'fields-only': fieldsOnly }">
    <header v-if="fieldsOnly" class="fields-side-head">
      <div class="fields-side-head-row">
        <div>
          <h3>采集字段</h3>
          <p v-if="node" class="fields-side-sub">当前节点：{{ node.name || '未命名' }}</p>
          <p v-else class="fields-side-sub">请先在画布上单击选择一个节点</p>
        </div>
        <el-button
          v-if="node && !readonly"
          type="primary"
          size="small"
          class="add-field-head-btn"
          @click="addNodeField"
        >
          + 添加字段
        </el-button>
      </div>
    </header>

    <template v-if="node">
      <header v-if="floating" class="floating-head">
        <div class="floating-head-main">
          <span class="floating-icon">{{ nodeTypeIcon }}</span>
          <div>
            <h3>{{ node.name || '未命名' }}</h3>
            <p class="floating-desc">{{ nodeTypeDesc }}</p>
          </div>
        </div>
        <button type="button" class="floating-close" title="关闭" @click="emit('close')">×</button>
      </header>

      <div class="panel-body">
        <div class="panel-main">
          <div v-if="fieldsOnly" class="fields-only-layout">
            <div class="fields-editor-scroll">
              <el-alert
                v-if="readonly"
                type="warning"
                :closable="false"
                show-icon
                title="只读模式，采集字段不可修改"
                class="fields-readonly-alert"
              />
              <p v-else class="hint block-hint">{{ fieldsPreviewHint }}</p>

              <div v-for="(field, fieldIndex) in nodeBoundFields" :key="field.id" class="field-editor-card">
              <div class="field-editor-head">
                <span>字段 {{ fieldIndex + 1 }}</span>
                <el-button v-if="!readonly" type="danger" link @click="removeNodeField(field.id)">
                  删除
                </el-button>
              </div>

              <div class="field-editor-row">
                <label>字段名称</label>
                <el-input
                  v-model="field.name"
                  :disabled="readonly"
                  size="small"
                  placeholder="如：客户姓名、现场照片"
                />
              </div>

              <div class="field-editor-row">
                <label>字段类型</label>
                <el-select
                  :model-value="field.fieldType"
                  :disabled="readonly"
                  size="small"
                  style="width: 100%"
                  @update:model-value="onFieldTypeChange(field, $event as WorkflowFieldType)"
                >
                  <el-option v-for="[key, label] in fieldTypeOptions" :key="key" :label="label" :value="key" />
                </el-select>
              </div>

              <div class="field-editor-row field-editor-row--inline">
                <el-checkbox v-model="field.required" :disabled="readonly || field.fieldType === 'switch'">
                  必填
                </el-checkbox>
                <span v-if="field.fieldType === 'switch'" class="hint inline-hint">开关类型无需必填</span>
              </div>

              <div v-if="field.fieldType === 'select'" class="field-editor-row">
                <label>枚举选项</label>
                <el-input
                  :model-value="selectOptionsText(field)"
                  :disabled="readonly"
                  size="small"
                  type="textarea"
                  :rows="2"
                  placeholder="多个选项用顿号、逗号或换行分隔"
                  @update:model-value="updateSelectOptions(field, $event)"
                />
              </div>
            </div>

              <p v-if="!nodeBoundFields.length" class="hint empty-fields-hint">暂无采集字段，点击上方「+ 添加字段」</p>
              <el-button v-if="!readonly" size="small" class="add-group-btn" @click="addNodeField">
                + 添加字段
              </el-button>
            </div>

            <div class="fields-preview-dock">
              <WorkflowFieldPreview
                :fields="nodeBoundFields"
                :preview-node-id="node.id"
                :node-label="node.name || '未命名'"
                :node-role="node.role"
                compact
              />
            </div>
          </div>

          <section v-if="floating && !fieldsOnly" class="block fields-pointer-block">
            <p class="fields-pointer">
              采集字段请在<strong>右侧栏</strong>点击「+ 添加字段」进行配置
            </p>
          </section>

          <template v-if="!fieldsOnly">
          <section class="block">
            <h4>【基本信息】</h4>
            <div class="field-compact">
              <label>节点名称</label>
              <el-input
                v-model="node.name"
                :disabled="readonly || isFixedStartNode"
                size="small"
                placeholder="如：待验收"
              />
            </div>
            <div class="field-compact">
              <label>阶段说明</label>
              <el-input
                v-model="node.stageLabel"
                :disabled="readonly || isFixedStartNode"
                size="small"
                placeholder="如：验收阶段（可选）"
              />
            </div>
            <div class="field-compact">
              <label>执行角色</label>
              <el-select
                v-model="node.role"
                :disabled="readonly || isFixedStartNode"
                size="small"
                style="width: 100%"
              >
                <el-option v-for="[role, label] in roleOptions" :key="role" :label="label" :value="role" />
              </el-select>
            </div>
            <div class="meta-line">
              <span>节点 ID</span>
              <code>{{ node.id }}</code>
            </div>
          </section>

          <section v-if="showEntryEditor" class="block entry-summary-block">
            <h4><span class="bolt">⚡</span> 【还需要满足什么条件？】</h4>
            <template v-if="entryGroups.length">
              <div
                v-for="(group, index) in entryGroups"
                :key="group.id"
                class="condition-group-tab"
                :class="{ active: activeGroupIndex === index }"
                @click="openGroupEditor(index)"
              >
                <div class="group-tab-head">
                  <span>条件组 {{ index + 1 }}</span>
                  <div class="group-tab-actions">
                    <button
                      v-if="!readonly"
                      type="button"
                      class="link-btn"
                      @click.stop="openGroupEditor(index)"
                    >
                      配置
                    </button>
                    <button
                      v-if="!readonly"
                      type="button"
                      class="link-btn danger"
                      @click.stop="removeConditionGroup(index)"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <ul class="condition-tree">
                  <li
                    v-for="line in formatEntryConditionSummary(group, allNodes, workflowFields)"
                    :key="line.key"
                  >
                    <span class="tree-branch">├──</span>
                    {{ line.text }}
                  </li>
                </ul>
              </div>

              <div v-if="editingGroupIndex !== null && activeGroup" class="inline-condition-editor">
                <div class="inline-editor-head">
                  <span>条件组 {{ editingGroupIndex + 1 }} 配置</span>
                  <button type="button" class="link-btn" @click="closeGroupEditor">收起</button>
                </div>

                <div class="editor-card">
                  <div class="editor-field">
                    <label>条件类型 <em class="req">*</em></label>
                    <el-select
                      :model-value="activeGroupType"
                      :disabled="readonly"
                      size="small"
                      style="width: 100%"
                      @update:model-value="onConditionTypeChange($event as WorkflowEntryConditionType)"
                    >
                      <el-option
                        v-for="opt in conditionTypeOptions"
                        :key="opt.value"
                        :label="opt.label"
                        :value="opt.value"
                      />
                    </el-select>
                  </div>

                  <template v-if="activeGroupType === 'punch_record'">
                    <div class="editor-field">
                      <label>待打卡提示 <em class="req">*</em></label>
                      <el-input
                        v-model="activeGroup.pendingPunchPrompt"
                        :disabled="readonly"
                        type="textarea"
                        :rows="2"
                        maxlength="200"
                        show-word-limit
                        size="small"
                        placeholder="进入本节点时，系统自动为执行人生成待打卡记录。"
                      />
                    </div>

                    <div class="editor-field">
                      <label>打卡方式 <em class="req">*</em></label>
                      <el-radio-group v-model="activeGroup.punchNavigateMode" :disabled="readonly" size="small">
                        <el-radio
                          v-for="[key, label] in punchNavigateOptions"
                          :key="key"
                          :value="key"
                        >
                          {{ label }}
                        </el-radio>
                      </el-radio-group>
                      <p class="hint">默认跳转至打卡页</p>
                    </div>

                    <div class="punch-rule-block">
                      <h5>打卡规则 <em class="req">*</em></h5>

                      <div class="editor-field">
                        <label>打卡方式（可多选）</label>
                        <div class="method-chips">
                          <button
                            v-for="method in workflowPunchMethodOptions"
                            :key="method"
                            type="button"
                            class="method-chip"
                            :class="{ on: punchMethodEnabled(method) }"
                            :disabled="readonly"
                            @click="togglePunchMethod(method)"
                          >
                            {{ workflowPunchMethodMap[method] }}
                          </button>
                        </div>
                        <p class="hint">WiFi、扫码仅可跟随执行人考勤组配置打卡</p>
                      </div>

                      <div class="editor-field">
                        <label>打卡次数</label>
                        <el-radio-group
                          v-model="activeGroup.punchCountMode"
                          :disabled="readonly"
                          size="small"
                        >
                          <el-radio
                            v-for="opt in punchCountModeOptions"
                            :key="opt.value"
                            :value="opt.value"
                          >
                            {{ opt.label }}
                          </el-radio>
                        </el-radio-group>
                      </div>

                      <div class="editor-field">
                        <label>打卡地点</label>
                        <el-select
                          v-model="activeGroup.locationSource"
                          :disabled="readonly"
                          size="small"
                          style="width: 100%"
                        >
                          <el-option
                            v-for="[key, label] in locationSourceOptions"
                            :key="key"
                            :label="label"
                            :value="key"
                          />
                        </el-select>
                      </div>

                      <div
                        v-if="activeGroup.locationSource === 'task_field'"
                        class="editor-field"
                      >
                        <label>地点字段</label>
                        <el-select
                          v-model="activeGroup.locationFieldId"
                          :disabled="readonly"
                          size="small"
                          style="width: 100%"
                          placeholder="选择任务自定义字段"
                        >
                          <el-option
                            v-for="opt in textFieldOptions"
                            :key="opt.value"
                            :label="opt.label"
                            :value="opt.value"
                          />
                        </el-select>
                        <p v-if="!textFieldOptions.length" class="hint">
                          请先在流程字段中添加文本类字段（≤200 字）
                        </p>
                      </div>

                      <div class="editor-field">
                        <label>打卡时间段</label>
                        <el-input model-value="任务起止时间" disabled size="small" />
                        <p class="hint">仅读取任务发布时的起止时间</p>
                      </div>

                      <div class="punch-rule-logic">
                        <p>生成待打卡记录规则：配置本条件后，将按上述打卡配置为执行人生成待打卡记录。</p>
                        <p>
                          打卡时间要求：晚于起始时段记为迟到；早于结束时段记为早退。超过 4
                          小时仍未打卡视为缺勤，须发起补卡审批后方可继续流转。进度中记录打卡、补卡等操作日志。
                        </p>
                      </div>
                    </div>
                  </template>

                  <div
                    v-if="activeGroupType === 'punch_record' || activeGroupType === 'time_condition'"
                    class="editor-field"
                  >
                    <label>未完成提示 <em class="req">*</em></label>
                    <el-input
                      v-model="activeGroup.incompletePrompt"
                      :disabled="readonly"
                      size="small"
                      maxlength="100"
                      show-word-limit
                      placeholder="面包屑下方展示的提示文案"
                    />
                  </div>

                  <div
                    v-if="activeGroupType === 'punch_record' || activeGroupType === 'time_condition'"
                    class="editor-field timeout-row"
                  >
                    <label>超时配置（天）</label>
                    <el-input-number
                      v-model="activeGroup.timeoutDays"
                      :disabled="readonly"
                      :min="1"
                      :max="90"
                      size="small"
                      controls-position="right"
                      :value-on-clear="undefined"
                    />
                    <el-button
                      v-if="!readonly && activeGroup.timeoutDays != null"
                      link
                      type="primary"
                      size="small"
                      @click="clearTimeoutDays"
                    >
                      清除
                    </el-button>
                    <p class="hint">
                      默认 3 天；清除后任务只能强制取消。提醒将生成待办；自动取消在终止打卡时间后超时未流转则取消；自动流转需指定目标节点。
                    </p>
                  </div>

                  <div
                    v-if="activeGroupType === 'punch_record' || activeGroupType === 'time_condition'"
                    class="editor-field"
                  >
                    <label>超时操作</label>
                    <el-select
                      :model-value="activeGroup.timeoutAction"
                      :disabled="readonly || activeGroup.timeoutDays == null"
                      size="small"
                      style="width: 100%"
                      @update:model-value="onTimeoutActionChange($event)"
                    >
                      <el-option
                        v-for="opt in timeoutActionOptions"
                        :key="opt.value"
                        :label="opt.label"
                        :value="opt.value"
                      />
                    </el-select>
                  </div>

                  <div
                    v-if="
                      (activeGroupType === 'punch_record' || activeGroupType === 'time_condition') &&
                      activeGroup.timeoutAction === 'auto_advance' &&
                      activeGroup.timeoutDays != null
                    "
                    class="editor-field"
                  >
                    <label>自动流转节点</label>
                    <el-select
                      v-model="activeGroup.timeoutTargetNodeId"
                      :disabled="readonly"
                      size="small"
                      style="width: 100%"
                      placeholder="选择流转节点"
                    >
                      <el-option v-for="opt in targetOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                    </el-select>
                  </div>
                </div>
              </div>
            </template>
            <p v-else class="hint">未配置进入条件，任务流转到该节点后立即可操作</p>
            <el-button
              v-if="!readonly"
              size="small"
              class="add-group-btn"
              @click="addConditionGroup"
            >
              + 添加条件组
            </el-button>
          </section>

          <section v-if="node.nodeType !== 'end'" class="block">
            <h4>【操作按钮】</h4>
            <p v-if="isFixedStartNode" class="hint block-hint">
              开始节点固定为「确认领取」，仅可配置流转目标节点
            </p>
            <p v-else class="hint block-hint">动作类型：提交 / 确认 / 取消 / 拒绝；可自定义按钮文案</p>
            <div v-if="node.actions.length" class="action-editor-list">
              <div v-for="(action, idx) in node.actions" :key="idx" class="action-editor-card">
                <div class="action-editor-head">
                  <span>按钮 {{ idx + 1 }}</span>
                  <button
                    v-if="!readonly && !isFixedStartNode"
                    type="button"
                    class="link-btn danger"
                    @click="removeAction(idx)"
                  >
                    删除
                  </button>
                </div>
                <div class="field-compact">
                  <label>按钮文案</label>
                  <el-input
                    v-model="action.label"
                    :disabled="readonly || isFixedStartNode"
                    size="small"
                    :placeholder="workflowActionMap[action.action === 'approve' ? 'confirm' : action.action]"
                  />
                </div>
                <div class="field-compact">
                  <label>动作类型</label>
                  <el-select
                    :model-value="action.action === 'approve' ? 'confirm' : action.action"
                    :disabled="readonly || isFixedStartNode"
                    size="small"
                    style="width: 100%"
                    @update:model-value="onActionTypeChange(action, $event as WorkflowAction)"
                  >
                    <el-option
                      v-for="opt in actionTypeOptions"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </div>
                <div class="field-compact">
                  <label>流转至</label>
                  <el-select
                    v-model="action.targetNodeId"
                    :disabled="readonly"
                    size="small"
                    style="width: 100%"
                    placeholder="选择目标节点"
                  >
                    <el-option v-for="opt in targetOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                  </el-select>
                </div>
              </div>
            </div>
            <p v-else class="hint">暂无操作按钮，点击下方添加或在画布拖连线</p>
            <el-button v-if="!readonly && !isFixedStartNode" size="small" class="add-group-btn" @click="addAction">
              + 添加操作按钮
            </el-button>
          </section>

          <section v-if="node.nodeType !== 'end'" class="block">
            <h4>【通知设置】</h4>
            <p class="hint block-hint">可选；节点到达时按勾选渠道通知</p>
            <div class="notify-row">
              <el-checkbox v-model="node.notifySms" :disabled="readonly">短信通知</el-checkbox>
              <el-checkbox v-model="node.notifyServiceAccount" :disabled="readonly">服务号通知</el-checkbox>
              <el-checkbox v-model="node.notifyMessage" :disabled="readonly">消息通知</el-checkbox>
            </div>
          </section>

          <section class="block collapsible-detail">
            <h4>【超时设置】</h4>
            <p class="hint block-hint">节点级超时：触发自动流转或取消</p>
            <div class="meta-line">
              <span>当前</span>
              <span>{{ timeoutSummary() }}</span>
            </div>
            <template v-if="!readonly && node.nodeType !== 'end'">
              <div class="field-compact" style="margin-top: 10px">
                <el-checkbox v-model="node.timeoutEnabled">启用超时</el-checkbox>
              </div>
              <div v-if="node.timeoutEnabled" class="timeout-config">
                <el-input-number
                  v-model="node.timeoutHours"
                  :min="1"
                  :max="720"
                  size="small"
                  controls-position="right"
                />
                <span>小时后流转至</span>
                <el-select v-model="node.timeoutTargetNodeId" size="small" placeholder="目标节点" style="width: 120px">
                  <el-option v-for="opt in targetOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </div>
            </template>
          </section>
          </template>
        </div>
      </div>

      <footer v-if="!fieldsOnly && canDelete" class="panel-footer">
        <el-button type="danger" plain size="small" @click="confirmRemoveNode">删除节点</el-button>
      </footer>
      <p v-else-if="!fieldsOnly && node && node.nodeType === 'start' && !readonly" class="panel-footer-hint">
        开始节点固定为「领取任务」，不可删除
      </p>
    </template>
    <div v-else-if="fieldsOnly" class="empty-panel fields-empty-panel">
      <p>尚未选择节点</p>
      <p class="hint">在画布上单击节点后，即可在此点击「+ 添加字段」</p>
    </div>
    <div v-else class="empty-panel">
      <p>单击画布上的节点</p>
      <p class="hint">在画布中选择节点打开配置</p>
    </div>
  </div>
</template>

<style scoped>
.config-panel {
  height: 100%;
  overflow: auto;
  background: #fff;
}

.config-panel.fields-only {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.fields-side-head {
  padding: 14px 16px 12px;
  border-bottom: 1px solid #eef0f3;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 2;
  background: #fff;
}

.fields-side-head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.add-field-head-btn {
  flex-shrink: 0;
}

.fields-readonly-alert {
  margin-bottom: 10px;
}

.fields-pointer-block {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.fields-pointer {
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.6;
  color: #606266;
  background: #f0f9ff;
  border: 1px solid #dbeafe;
  border-radius: 8px;
}

.fields-empty-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.fields-side-head h3 {
  margin: 0;
  font-size: 14px;
  color: #111827;
}

.fields-side-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.fields-only .fields-block {
  margin-top: 0;
}

.fields-only .panel-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.fields-only .panel-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
}

.fields-only-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.fields-editor-scroll {
  flex: 1;
  overflow: auto;
  padding: 14px;
  min-height: 0;
}

.fields-preview-dock {
  flex-shrink: 0;
  border-top: 2px solid #e5e7eb;
  background: #f8fafc;
  padding: 0 14px 14px;
  max-height: 46%;
  overflow: auto;
}

.fields-preview-dock :deep(.field-preview) {
  margin-top: 10px;
  padding-top: 0;
  border-top: none;
}

.config-panel.floating {
  height: auto;
  max-height: inherit;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.floating-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
  flex-shrink: 0;
}

.floating-head-main {
  display: flex;
  gap: 10px;
  min-width: 0;
}

.floating-icon {
  font-size: 20px;
  line-height: 1;
  margin-top: 2px;
}

.floating-head h3 {
  margin: 0;
  font-size: 15px;
  color: #111827;
  word-break: break-all;
}

.floating-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
}

.floating-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.floating-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.config-panel.floating .panel-body {
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.config-panel.floating .panel-main {
  padding-top: 12px;
}

.panel-body {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.panel-main {
  flex: 1;
  padding: 14px;
  overflow: auto;
}

.panel-head h3 {
  margin: 0;
  font-size: 14px;
  color: #303133;
}

.panel-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.collect-field-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.collect-field-row .el-input {
  flex: 1;
  min-width: 100px;
}

.field-editor-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
  background: #fafafa;
}

.field-editor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}

.field-editor-row {
  margin-bottom: 8px;
}

.field-editor-row:last-child {
  margin-bottom: 0;
}

.field-editor-row label {
  display: block;
  font-size: 11px;
  color: #909399;
  margin-bottom: 4px;
}

.field-editor-row--inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inline-hint {
  margin: 0;
}

.empty-fields-hint {
  text-align: center;
  padding: 8px 0;
}

.block {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed #ebeef5;
}

.block h4 {
  margin: 0 0 10px;
  font-size: 12px;
  color: #606266;
  font-weight: 600;
}

.block-hint {
  margin: -4px 0 10px;
}

.action-editor-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-editor-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px;
  background: #fafafa;
}

.action-editor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}

.timeout-config {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: #606266;
}

.bolt {
  margin-right: 2px;
}

.field-compact {
  margin-bottom: 10px;
}

.field-compact label {
  display: block;
  font-size: 11px;
  color: #909399;
  margin-bottom: 4px;
}

.meta-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}

.meta-line code {
  font-size: 11px;
  color: #606266;
}

.condition-group-tab {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  cursor: pointer;
  background: #fff;
  transition: border-color 0.15s;
}

.condition-group-tab.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.group-tab-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.group-tab-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inline-condition-editor {
  margin: 4px 0 10px;
  padding: 10px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #f8fafc;
}

.inline-editor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #303133;
}

.link-btn {
  border: none;
  background: none;
  font-size: 11px;
  color: #409eff;
  cursor: pointer;
  padding: 0;
}

.link-btn.danger {
  color: #f56c6c;
}

.condition-tree {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 11px;
  color: #606266;
  line-height: 1.7;
}

.tree-branch {
  color: #c0c4cc;
  font-family: monospace;
  margin-right: 4px;
}

.add-group-btn {
  width: 100%;
  margin-top: 4px;
}

.action-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.action-chip {
  border: 1px solid #dcdfe6;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  color: #303133;
}

.flow-list {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
}

.flow-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 12px;
}

.arrow {
  color: #c0c4cc;
}

.collapsible-detail {
  font-size: 12px;
}

.editor-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
}

.editor-field {
  margin-bottom: 12px;
}

.editor-field label {
  display: block;
  font-size: 11px;
  color: #909399;
  margin-bottom: 6px;
}

.punch-flow-hint {
  margin-bottom: 12px;
  padding: 10px;
  background: #f0f9ff;
  border-radius: 6px;
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
}

.punch-flow-hint p {
  margin: 0 0 6px;
}

.punch-flow-hint p:last-child {
  margin-bottom: 0;
}

.punch-rule-block {
  margin-top: 12px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #e0e7ff;
  background: #f8fafc;
}

.punch-rule-block h5 {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.punch-rule-logic {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #fff;
  border: 1px dashed #cbd5e1;
}

.punch-rule-logic p {
  margin: 0 0 6px;
  font-size: 11px;
  line-height: 1.55;
  color: #64748b;
}

.punch-rule-logic p:last-child {
  margin-bottom: 0;
}

.req {
  color: #f56c6c;
  font-style: normal;
  margin-left: 2px;
}

.notify-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.method-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.method-chip {
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  color: #606266;
}

.method-chip.on {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
}

.method-chip:disabled {
  cursor: default;
}

.time-window-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.time-window-row label {
  width: 100%;
}

.readonly-hint {
  font-size: 12px;
  color: #606266;
}

.readonly-hint span {
  display: block;
  padding: 6px 8px;
  background: #f5f7fa;
  border-radius: 4px;
}

.timeout-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.timeout-row label {
  width: 100%;
}

.empty-panel {
  padding: 24px 12px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

.hint {
  font-size: 12px;
  color: #909399;
  margin: 4px 0;
}

.panel-footer {
  flex-shrink: 0;
  padding: 10px 14px 14px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
}

.panel-footer-hint {
  flex-shrink: 0;
  margin: 0;
  padding: 10px 14px 14px;
  border-top: 1px solid #f0f0f0;
  font-size: 12px;
  color: #909399;
  text-align: center;
}
</style>
