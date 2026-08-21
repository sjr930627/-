<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import OrgChartCanvas, { type OrgChartNode } from '@/components/org/OrgChartCanvas.vue'
import OrgDeptEditPanel from '@/components/org/OrgDeptEditPanel.vue'
import {
  isUnassignedDepartment,
  isEnterpriseRootDepartment,
  enterpriseUnassignedDepartmentId,
} from '@/constants/department'
import {
  buildDepartmentTree,
  countDepartmentEmployees,
  getDepartmentName,
} from '@/utils'
import type { Department, DepartmentTreeNode, Employee } from '@/types'

const props = defineProps<{
  visible: boolean
  departments: Department[]
  employees: Employee[]
  enterpriseId: string
  defaultParentId?: string | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: []
}>()

const store = useAppStore()
const selectedId = ref('')

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

function enrichTree(nodes: DepartmentTreeNode[]): OrgChartNode[] {
  return nodes.map((node) => ({
    ...node,
    headcount: countDepartmentEmployees(props.departments, props.employees, node.id, true),
    children: enrichTree(node.children),
  }))
}

const treeData = computed(() => enrichTree(buildDepartmentTree(props.departments)))

const lockedIds = computed(() => {
  const ids: string[] = []
  const unassigned = enterpriseUnassignedDepartmentId(props.enterpriseId)
  if (unassigned) ids.push(unassigned)
  props.departments.forEach((d) => {
    if (isEnterpriseRootDepartment(d) || isUnassignedDepartment(d.id)) ids.push(d.id)
  })
  return [...new Set(ids)]
})

const selectedDept = computed(
  () => props.departments.find((d) => d.id === selectedId.value) ?? null,
)

const selectedLocked = computed(() =>
  selectedDept.value
    ? isUnassignedDepartment(selectedDept.value.id) ||
      isEnterpriseRootDepartment(selectedDept.value)
    : false,
)

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    const preferred =
      (props.defaultParentId &&
        props.departments.some((d) => d.id === props.defaultParentId) &&
        props.defaultParentId) ||
      treeData.value[0]?.id ||
      ''
    selectedId.value = preferred
  },
)

watch(treeData, (tree) => {
  if (!props.visible) return
  if (!selectedId.value || !props.departments.some((d) => d.id === selectedId.value)) {
    selectedId.value = tree[0]?.id ?? ''
  }
})

function onSelect(id: string) {
  selectedId.value = id
}

function onAddChild(parentId: string | null) {
  try {
    const parent = parentId ? props.departments.find((d) => d.id === parentId) : null
    if (parent?.nodeType === 'leaf') {
      ElMessage.warning('叶节点下不可创建子组织')
      return
    }
    const siblings = props.departments.filter((d) => d.parentId === parentId)
    const item = store.addDepartment({
      name: '新建组织',
      parentId,
      sort: siblings.length + 1,
      enterpriseId: props.enterpriseId,
      orgType: 'department',
      nodeType: 'branch',
      code: `ORG-${String(siblings.length + 1).padStart(2, '0')}`,
      description: '',
    })
    selectedId.value = item.id
    ElMessage.success('已添加，请在右侧完善信息')
    emit('saved')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '添加失败')
  }
}

function onReorder(draggedId: string, targetParentId: string | null, targetIndex: number) {
  try {
    const siblings = props.departments
      .filter((d) => d.parentId === targetParentId && d.id !== draggedId)
      .sort((a, b) => a.sort - b.sort)
    if (siblings[targetIndex]) {
      store.reorderDepartment(draggedId, siblings[targetIndex].id, 'before')
    } else if (siblings.length) {
      store.reorderDepartment(draggedId, siblings[siblings.length - 1].id, 'after')
    } else if (targetParentId) {
      store.reorderDepartment(draggedId, targetParentId, 'inner')
    } else {
      const roots = props.departments
        .filter((d) => !d.parentId && d.id !== draggedId)
        .sort((a, b) => a.sort - b.sort)
      if (roots.length) store.reorderDepartment(draggedId, roots[roots.length - 1].id, 'after')
    }
    emit('saved')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '调整失败')
  }
}

async function onRemove() {
  if (!selectedDept.value) return
  try {
    await ElMessageBox.confirm(`确定删除组织「${selectedDept.value.name}」？`, '删除组织', {
      type: 'warning',
    })
    const parentId = selectedDept.value.parentId
    store.removeDepartment(selectedDept.value.id)
    selectedId.value = parentId ?? treeData.value[0]?.id ?? ''
    ElMessage.success('已删除')
    emit('saved')
  } catch (e) {
    if (e !== 'cancel' && !(e instanceof Error && e.message === 'cancel')) {
      if (e instanceof Error) ElMessage.error(e.message)
    }
  }
}

function onPanelSaved() {
  emit('saved')
}

const breadcrumb = computed(() => {
  if (!selectedDept.value) return '请选择节点'
  const parentName = selectedDept.value.parentId
    ? getDepartmentName(props.departments, selectedDept.value.parentId)
    : '根'
  return `${parentName} / ${selectedDept.value.name}`
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="编辑组织架构"
    width="1280px"
    top="3vh"
    destroy-on-close
    class="org-canvas-dialog"
    append-to-body
  >
    <div class="canvas-workspace">
      <div class="canvas-main">
        <div class="canvas-toolbar">
          <div>
            <strong>组织树</strong>
            <span class="hint">拖拽排序 · 点击节点编辑右侧详情 · 「添加组织」新增子节点</span>
          </div>
          <el-button type="primary" @click="onAddChild(selectedId || null)">添加组织</el-button>
        </div>
        <p v-if="selectedDept" class="path">当前：{{ breadcrumb }}</p>
        <OrgChartCanvas
          :tree="treeData"
          :selected-id="selectedId"
          :locked-ids="lockedIds"
          @select="onSelect"
          @add-child="onAddChild"
          @reorder="onReorder"
        />
      </div>
      <OrgDeptEditPanel
        class="canvas-side"
        :department="selectedDept"
        :departments="departments"
        :employees="employees"
        :locked="selectedLocked"
        @saved="onPanelSaved"
        @remove="onRemove"
      />
    </div>
    <template #footer>
      <el-button type="primary" @click="dialogVisible = false">完成</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.canvas-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: 16px;
  align-items: stretch;
  min-height: 560px;
}

.canvas-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.canvas-toolbar strong {
  font-size: 14px;
  margin-right: 10px;
}

.hint {
  font-size: 12px;
  color: #94a3b8;
}

.path {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

.canvas-side {
  min-height: 560px;
}

@media (max-width: 960px) {
  .canvas-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
