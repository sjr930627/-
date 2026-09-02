<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { workflowRoleMap } from '@/constants/task'
import type { WorkflowNode, WorkflowRole } from '@/types'
import { getMainPathOrdered } from '@/utils/workflowGraphLayout'
import { buildWorkflowFlowEdges } from '@/utils/workflow'

const props = defineProps<{
  visible: boolean
  nodes: WorkflowNode[]
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  step: [nodeId: string, status: 'running' | 'success' | 'waiting' | 'error']
  done: []
}>()

const role = ref<WorkflowRole>('worker')
const running = ref(false)
const stepIndex = ref(-1)

const pathIds = computed(() => getMainPathOrdered(props.nodes, buildWorkflowFlowEdges(props.nodes)))
const pathNodes = computed(() =>
  pathIds.value.map((id) => props.nodes.find((n) => n.id === id)).filter(Boolean) as WorkflowNode[],
)

const roleOptions = Object.entries(workflowRoleMap) as [WorkflowRole, string][]

watch(
  () => props.visible,
  (v) => {
    if (!v) {
      running.value = false
      stepIndex.value = -1
    }
  },
)

async function startRun() {
  if (!pathNodes.value.length) return
  running.value = true
  stepIndex.value = -1
  for (let i = 0; i < pathNodes.value.length; i++) {
    stepIndex.value = i
    const node = pathNodes.value[i]
    const hasPunch = node.entryConditionGroups?.some((g) => g.type === 'punch_record')
    emit('step', node.id, hasPunch && i > 0 ? 'waiting' : 'running')
    await sleep(700)
    emit('step', node.id, 'success')
    await sleep(300)
  }
  running.value = false
  emit('done')
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function close() {
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog :model-value="visible" title="试运行" width="420px" @update:model-value="close">
    <p class="hint">模拟流程沿主路径执行，画布节点将依次高亮。</p>
    <el-form label-width="88px">
      <el-form-item label="模拟角色">
        <el-select v-model="role" style="width: 100%">
          <el-option v-for="[key, label] in roleOptions" :key="key" :label="label" :value="key" />
        </el-select>
      </el-form-item>
    </el-form>
    <ol class="step-list">
      <li
        v-for="(node, i) in pathNodes"
        :key="node.id"
        :class="{
          active: running && stepIndex === i,
          done: !running && stepIndex >= i,
        }"
      >
        {{ node.name }}
        <span v-if="node.entryConditionGroups?.length" class="tag">含外部条件</span>
      </li>
    </ol>
    <template #footer>
      <el-button @click="close">关闭</el-button>
      <el-button type="primary" :loading="running" @click="startRun">开始试运行</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 12px;
}

.step-list {
  margin: 12px 0 0;
  padding-left: 20px;
  font-size: 13px;
  color: #374151;
}

.step-list li {
  margin-bottom: 6px;
}

.step-list li.active {
  color: #f97316;
  font-weight: 700;
}

.step-list li.done {
  color: #10b981;
}

.tag {
  margin-left: 6px;
  font-size: 10px;
  color: #d97706;
  background: #fffbeb;
  padding: 1px 6px;
  border-radius: 4px;
}
</style>
