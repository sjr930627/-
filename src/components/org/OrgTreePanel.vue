<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ElTree } from 'element-plus'
import {
  isUnassignedDepartment,
  isEnterpriseRootDepartment,
} from '@/constants/department'
import { getDepartmentDescendantIds } from '@/utils'
import type { Department, DepartmentTreeNode } from '@/types'

export interface OrgTreeNode extends DepartmentTreeNode {
  headcount?: number
}

const props = withDefaults(
  defineProps<{
    tree: OrgTreeNode[]
    departments: Department[]
    selectedId?: string
    /** 编辑态：允许拖拽排序与节点旁快捷添加 */
    editable?: boolean
    lockedIds?: string[]
  }>(),
  {
    selectedId: '',
    editable: false,
    lockedIds: () => [],
  },
)

const emit = defineEmits<{
  select: [id: string]
  addChild: [parentId: string | null]
  reorder: [dragId: string, dropId: string, position: 'before' | 'after' | 'inner']
}>()

const treeRef = ref<InstanceType<typeof ElTree>>()
const keyword = ref('')

watch(keyword, (val) => {
  treeRef.value?.filter(val)
})

watch(
  () => props.selectedId,
  (id) => {
    if (id) treeRef.value?.setCurrentKey(id)
  },
)

function filterNode(value: string, data: OrgTreeNode) {
  if (!value) return true
  return data.name.includes(value)
}

function isLocked(id: string) {
  return props.lockedIds.includes(id)
}

function canAddUnder(data: OrgTreeNode) {
  return props.editable && !isLocked(data.id) && data.nodeType !== 'leaf'
}

type TreeDropType = 'prev' | 'next' | 'inner'

function allowDrag(node: { data: OrgTreeNode }) {
  if (!props.editable) return false
  return !isLocked(node.data.id) && !isEnterpriseRootDepartment(node.data)
}

function allowDrop(
  draggingNode: { data: OrgTreeNode },
  dropNode: { data: OrgTreeNode },
  type: TreeDropType,
) {
  if (!props.editable) return false
  const draggingId = draggingNode.data.id
  if (isLocked(draggingId) || isLocked(dropNode.data.id)) return false
  if (isUnassignedDepartment(draggingId) || isUnassignedDepartment(dropNode.data.id)) return false
  if (type === 'inner' && dropNode.data.nodeType === 'leaf') return false
  const descendants = getDepartmentDescendantIds(props.departments, draggingId)
  if (descendants.has(dropNode.data.id)) return false
  return true
}

function mapDropType(type: TreeDropType): 'before' | 'after' | 'inner' {
  if (type === 'prev') return 'before'
  if (type === 'next') return 'after'
  return 'inner'
}

function handleNodeClick(data: OrgTreeNode) {
  emit('select', data.id)
}

function handleNodeDrop(
  draggingNode: { data: OrgTreeNode },
  dropNode: { data: OrgTreeNode },
  dropType: TreeDropType,
) {
  emit('reorder', draggingNode.data.id, dropNode.data.id, mapDropType(dropType))
}

const nodeCount = computed(() => props.departments.length)
</script>

<template>
  <div class="org-tree-panel">
    <div class="org-panel-header">
      <span class="org-title">组织架构树</span>
      <el-tag size="small" type="info" round>{{ nodeCount }}</el-tag>
      <el-tag v-if="editable" size="small" type="warning" round>编辑中</el-tag>
    </div>
    <el-input
      v-model="keyword"
      placeholder="搜索部门"
      clearable
      prefix-icon="Search"
      class="org-search"
    />
    <el-tree
      ref="treeRef"
      :data="tree"
      node-key="id"
      default-expand-all
      highlight-current
      :draggable="editable"
      :allow-drop="allowDrop"
      :allow-drag="allowDrag"
      :current-node-key="selectedId"
      :expand-on-click-node="false"
      :filter-node-method="filterNode"
      @node-click="handleNodeClick"
      @node-drop="handleNodeDrop"
    >
      <template #default="{ data }">
        <div
          class="tree-node"
          :class="{
            'tree-node--unassigned': isUnassignedDepartment(data.id),
            'tree-node--locked': isLocked(data.id),
          }"
        >
          <el-icon v-if="editable && !isLocked(data.id)" class="drag-handle"><Rank /></el-icon>
          <el-icon v-else-if="isUnassignedDepartment(data.id)" class="unassigned-icon">
            <User />
          </el-icon>
          <span class="tree-name">{{ data.name }}</span>
          <span v-if="data.headcount != null" class="tree-count">{{ data.headcount }}人</span>
          <el-button
            v-if="canAddUnder(data)"
            link
            type="primary"
            class="tree-add"
            @click.stop="emit('addChild', data.id)"
          >
            +
          </el-button>
        </div>
      </template>
    </el-tree>
    <p class="org-tree-tip">
      {{ editable ? '拖拽可调整顺序；点击节点在右侧编辑，可批量新增' : '点击节点查看详情' }}
    </p>
  </div>
</template>

<style scoped>
.org-tree-panel {
  min-width: 0;
}

.org-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.org-title {
  font-weight: 600;
  font-size: 14px;
  color: #1a1a2e;
}

.org-search {
  margin-bottom: 12px;
}

.org-tree-panel :deep(.el-tree) {
  background: transparent;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}

.org-tree-panel :deep(.el-tree-node__content) {
  height: 36px;
  border-radius: 6px;
}

.org-tree-panel :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--app-primary-light, #eff6ff);
  color: var(--app-primary, #3b82f6);
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding-right: 8px;
  font-size: 13px;
}

.drag-handle {
  color: #cbd5e1;
  cursor: grab;
  flex-shrink: 0;
}

.unassigned-icon {
  color: #94a3b8;
  flex-shrink: 0;
}

.tree-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-count {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}

.tree-add {
  padding: 0 4px;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}

.org-tree-tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
  text-align: center;
}
</style>
