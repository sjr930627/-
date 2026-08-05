<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ElTree } from 'element-plus'
import { useAppStore } from '@/stores/app'
import DepartmentFormDialog from '@/components/employee/DepartmentFormDialog.vue'
import EmployeeFormDrawer from '@/components/employee/EmployeeFormDrawer.vue'
import EmployeeImportDialog from '@/components/employee/EmployeeImportDialog.vue'
import EmployeeBatchAssignDialog from '@/components/employee/EmployeeBatchAssignDialog.vue'
import {
  isUnassignedDepartment,
  isEnterpriseRootDepartment,
  enterpriseRootDepartmentId,
  enterpriseUnassignedDepartmentId,
} from '@/constants/department'
import {
  buildDepartmentTree,
  countDepartmentEmployees,
  getDepartmentDescendantIds,
  getDepartmentName,
} from '@/utils'
import { attendanceGroupTypeMap, formatShiftPeriod } from '@/constants/attendanceGroup'
import type { DepartmentTreeNode, Employee, EmployeeStatus } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const treeRef = ref<InstanceType<typeof ElTree>>()
const treeKeyword = ref('')
const selectedDeptId = ref('dept_prod_a')
const deptDialogVisible = ref(false)
const editingDeptId = ref<string | null>(null)
const defaultParentId = ref<string | null>(null)
const employeeDialogVisible = ref(false)
const employeeImportVisible = ref(false)
const batchAssignVisible = ref(false)
const selectedEmployeeIds = ref<string[]>([])
const employeeTableRef = ref()
const editingEmployeeId = ref<string | null>(null)
const employeeKeyword = ref('')
const filterStatus = ref<EmployeeStatus | ''>('')

const statusMap: Record<EmployeeStatus, { label: string; type: 'success' | 'warning' | 'info' }> = {
  pending: { label: '待入职', type: 'warning' },
  active: { label: '正常', type: 'success' },
  resigned: { label: '已离职', type: 'info' },
}

const activeEnterpriseId = computed(() => {
  const fromRoute = route.params.enterpriseId as string | undefined
  if (fromRoute) return fromRoute
  return store.currentEnterpriseId
})

const currentEnterprise = computed(
  () => store.enterprises.find((e) => e.id === activeEnterpriseId.value) ?? store.currentEnterprise,
)

const isPlatformOrgView = computed(() => Boolean(route.params.enterpriseId))

const scopedDepartments = computed(() => store.getDepartmentsByEnterprise(activeEnterpriseId.value))

const scopedEmployees = computed(() => store.getEmployeesByEnterprise(activeEnterpriseId.value))

const employeeDetailBase = computed(() => {
  if (isPlatformOrgView.value) return `/employees/org/${activeEnterpriseId.value}`
  if (route.path.startsWith('/enterprise')) return '/enterprise/employees'
  return '/employees'
})

interface TreeNode extends DepartmentTreeNode {
  headcount: number
}

function enrichTree(nodes: DepartmentTreeNode[]): TreeNode[] {
  return nodes.map((node) => ({
    ...node,
    headcount: countDepartmentEmployees(scopedDepartments.value, scopedEmployees.value, node.id, true),
    children: enrichTree(node.children),
  }))
}

const treeData = computed(() => enrichTree(buildDepartmentTree(scopedDepartments.value)))

const selectedDept = computed(() =>
  scopedDepartments.value.find((d) => d.id === selectedDeptId.value),
)

const isUnassignedDept = computed(() => isUnassignedDepartment(selectedDeptId.value))

const isEnterpriseRootDept = computed(() =>
  selectedDept.value ? isEnterpriseRootDepartment(selectedDept.value) : false,
)

const selectedAttendanceGroup = computed(() => {
  const groupId = selectedDept.value?.attendanceGroupId
  return store.attendanceGroups.find((g) => g.id === groupId)
})

const nodeTypeLabel = computed(() =>
  selectedDept.value?.nodeType === 'leaf' ? '叶节点' : '非叶节点',
)

const deptEmployeeCount = computed(() => {
  if (!selectedDeptId.value) return 0
  return countDepartmentEmployees(
    scopedDepartments.value,
    scopedEmployees.value,
    selectedDeptId.value,
    true,
  )
})

const directEmployeeCount = computed(() => {
  if (!selectedDeptId.value) return 0
  return countDepartmentEmployees(
    scopedDepartments.value,
    scopedEmployees.value,
    selectedDeptId.value,
    false,
  )
})

const deptLevelLabel = computed(() => {
  if (!selectedDept.value) return '-'
  let level = 1
  let parentId = selectedDept.value.parentId
  while (parentId) {
    level += 1
    parentId = scopedDepartments.value.find((d) => d.id === parentId)?.parentId ?? null
  }
  const labels = ['一级', '二级', '三级', '四级', '五级']
  return labels[level - 1] ? `${labels[level - 1]}部门` : `${level}级部门`
})

const managerEmployee = computed(() => {
  if (!selectedDept.value) return null
  if (selectedDept.value.managerEmployeeId) {
    return (
      scopedEmployees.value.find((e) => e.id === selectedDept.value!.managerEmployeeId) ?? null
    )
  }
  return (
    scopedEmployees.value.find(
      (e) => e.departmentId === selectedDeptId.value && e.position.includes('组长'),
    ) ??
    scopedEmployees.value.find((e) => e.departmentId === selectedDeptId.value) ??
    null
  )
})

const employeeTableData = computed(() => {
  if (!selectedDeptId.value) return []
  const ids = getDepartmentDescendantIds(scopedDepartments.value, selectedDeptId.value)
  return scopedEmployees.value
    .filter((e) => {
      if (!ids.has(e.departmentId)) return false
      if (employeeKeyword.value) {
        const k = employeeKeyword.value.toLowerCase()
        if (
          !e.name.includes(k) &&
          !e.employeeNo.toLowerCase().includes(k) &&
          !(e.phone ?? '').includes(k)
        ) {
          return false
        }
      }
      if (filterStatus.value && e.status !== filterStatus.value) return false
      return true
    })
    .map((e) => ({
      ...e,
      departmentName: getDepartmentName(scopedDepartments.value, e.departmentId),
      isDirect: e.departmentId === selectedDeptId.value,
    }))
})

watch(
  activeEnterpriseId,
  (enterpriseId) => {
    store.ensureEnterpriseOrgStructure(enterpriseId)
    const depts = store.getDepartmentsByEnterprise(enterpriseId)
    const unassignedId = enterpriseUnassignedDepartmentId(enterpriseId)
    const preferred =
      depts.find((d) => d.id === 'dept_prod_a') ??
      depts.find((d) => d.id === unassignedId) ??
      depts.find((d) => d.orgType === 'enterprise') ??
      depts[0]
    selectedDeptId.value = preferred?.id ?? unassignedId
  },
  { immediate: true },
)

watch(treeKeyword, (val) => {
  treeRef.value?.filter(val)
})

function filterTreeNode(value: string, data: TreeNode) {
  if (!value) return true
  return data.name.includes(value)
}

function handleNodeClick(data: TreeNode) {
  selectedDeptId.value = data.id
}

function openCreateDept(parentId: string | null = null) {
  const parent = parentId ? scopedDepartments.value.find((d) => d.id === parentId) : null
  if (parent?.nodeType === 'leaf') {
    ElMessage.warning('叶节点下不可创建子部门')
    return
  }
  editingDeptId.value = null
  const rootDept =
    scopedDepartments.value.find((d) => d.orgType === 'enterprise')?.id ??
    enterpriseRootDepartmentId(activeEnterpriseId.value)
  const fallbackParent = isUnassignedDepartment(selectedDeptId.value)
    ? rootDept
    : selectedDeptId.value
  defaultParentId.value = parentId ?? fallbackParent ?? rootDept
  deptDialogVisible.value = true
}

function openEditDept() {
  if (
    !selectedDept.value ||
    isUnassignedDept.value ||
    isEnterpriseRootDepartment(selectedDept.value)
  ) {
    return
  }
  editingDeptId.value = selectedDept.value.id
  defaultParentId.value = selectedDept.value.parentId
  deptDialogVisible.value = true
}

function handleDeptSaved(deptId: string) {
  selectedDeptId.value = deptId
}

type TreeDropType = 'prev' | 'next' | 'inner'

function mapDropType(type: TreeDropType): 'before' | 'after' | 'inner' {
  if (type === 'prev') return 'before'
  if (type === 'next') return 'after'
  return 'inner'
}

function allowDrag(node: { data: TreeNode }) {
  return !isUnassignedDepartment(node.data.id) && !isEnterpriseRootDepartment(node.data)
}

function allowDrop(_draggingNode: unknown, dropNode: TreeNode, type: TreeDropType) {
  const draggingId = (_draggingNode as { data: TreeNode }).data.id
  if (isUnassignedDepartment(draggingId) || isUnassignedDepartment(dropNode.id)) return false
  if (type === 'inner' && dropNode.nodeType === 'leaf') return false
  const descendants = getDepartmentDescendantIds(scopedDepartments.value, draggingId)
  if (descendants.has(dropNode.id)) return false
  return true
}

function handleNodeDrop(
  draggingNode: { data: TreeNode },
  dropNode: { data: TreeNode },
  dropType: TreeDropType,
) {
  try {
    store.reorderDepartment(
      draggingNode.data.id,
      dropNode.data.id,
      mapDropType(dropType),
    )
    ElMessage.success('部门顺序已更新')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '调整失败')
  }
}

async function removeDept() {
  if (!selectedDept.value || isUnassignedDept.value) return
  try {
    await ElMessageBox.confirm(`确定删除部门「${selectedDept.value.name}」？`, '提示', {
      type: 'warning',
    })
    const parentId = selectedDept.value.parentId
    store.removeDepartment(selectedDept.value.id)
    selectedDeptId.value = parentId ?? scopedDepartments.value[0]?.id ?? ''
    ElMessage.success('部门已删除')
  } catch (e) {
    if (e !== 'cancel' && e instanceof Error) ElMessage.error(e.message)
  }
}

function openCreateEmployee() {
  if (!selectedDeptId.value) {
    ElMessage.warning('请先选择部门')
    return
  }
  editingEmployeeId.value = null
  employeeDialogVisible.value = true
}

function openEditEmployee(emp: Employee) {
  editingEmployeeId.value = emp.id
  employeeDialogVisible.value = true
}

async function removeEmployee(emp: Employee) {
  await ElMessageBox.confirm(`确定删除「${emp.name}」？`, '提示', { type: 'warning' })
  store.removeEmployee(emp.id)
  ElMessage.success('已删除')
}

function openEmployeeDetail(emp: Employee) {
  router.push(`${employeeDetailBase.value}/${emp.id}`)
}

function backToOverview() {
  router.push('/employees')
}

function maskPhone(phone?: string) {
  if (!phone) return '-'
  if (phone.includes('*')) return phone
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

function handleEmployeeSelection(rows: Employee[]) {
  selectedEmployeeIds.value = rows.map((row) => row.id)
}

function openBatchAssign() {
  if (!selectedEmployeeIds.value.length) {
    ElMessage.warning('请先选择要分配的人员')
    return
  }
  batchAssignVisible.value = true
}

function handleBatchAssigned() {
  selectedEmployeeIds.value = []
  employeeTableRef.value?.clearSelection()
}
</script>

<template>
  <div class="personnel-page">
    <div class="page-actions">
      <div class="page-actions-left">
        <el-button v-if="isPlatformOrgView" link type="primary" @click="backToOverview">
          <el-icon><ArrowLeft /></el-icon>
          返回企业列表
        </el-button>
        <span class="enterprise-tag">{{ currentEnterprise?.name ?? '当前企业' }}</span>
      </div>
      <div class="page-actions-right">
        <el-button plain @click="employeeImportVisible = true">批量导入</el-button>
        <el-button plain>批量导出</el-button>
        <el-button type="primary" @click="openCreateDept(null)">+ 新增部门</el-button>
      </div>
    </div>

    <div class="org-panel page-card">
      <div class="org-panel-header">
        <span class="org-title">组织架构树</span>
        <el-tag size="small" type="info" round>{{ scopedDepartments.length }}</el-tag>
      </div>
      <el-input
        v-model="treeKeyword"
        placeholder="搜索部门"
        clearable
        prefix-icon="Search"
        class="org-search"
      />
      <el-tree
        ref="treeRef"
        :data="treeData"
        node-key="id"
        default-expand-all
        highlight-current
        draggable
        :allow-drop="allowDrop"
        :allow-drag="allowDrag"
        :current-node-key="selectedDeptId"
        :expand-on-click-node="false"
        :filter-node-method="filterTreeNode"
        @node-click="handleNodeClick"
        @node-drop="handleNodeDrop"
      >
        <template #default="{ data }">
          <div class="tree-node" :class="{ 'tree-node--unassigned': isUnassignedDepartment(data.id) }">
            <el-icon v-if="!isUnassignedDepartment(data.id)" class="drag-handle"><Rank /></el-icon>
            <el-icon v-else class="unassigned-icon"><User /></el-icon>
            <span class="tree-name">{{ data.name }}</span>
            <span class="tree-count">{{ data.headcount }}人</span>
          </div>
        </template>
      </el-tree>
      <p class="org-tree-tip">拖拽可实现部门顺序排序</p>
    </div>

    <div class="detail-panel">
      <template v-if="selectedDept">
        <div class="page-card dept-card">
          <div class="dept-card-header">
            <div class="dept-title-wrap">
              <div class="dept-icon" :class="{ 'dept-icon--unassigned': isUnassignedDept }">
                <el-icon><User v-if="isUnassignedDept" /><OfficeBuilding v-else /></el-icon>
              </div>
              <div>
                <h2 class="page-title">{{ selectedDept.name }}</h2>
                <p class="text-muted dept-path">
                  <template v-if="isUnassignedDept">
                    系统默认部门 · 管理待入职及未分配部门和岗位的人员
                  </template>
                  <template v-else>
                    {{ currentEnterprise?.name }} / {{ getDepartmentName(scopedDepartments, selectedDept.parentId ?? '') || '根节点' }} / {{ selectedDept.name }}
                  </template>
                </p>
              </div>
            </div>
            <div v-if="!isUnassignedDept && !isEnterpriseRootDept" class="dept-actions">
              <el-button plain @click="openEditDept">
                <el-icon><Edit /></el-icon>
                编辑
              </el-button>
              <el-button plain type="danger" @click="removeDept">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </div>

          <div class="section-label">基本信息</div>
          <el-descriptions :column="3" border class="dept-info">
            <el-descriptions-item label="部门名称">{{ selectedDept.name }}</el-descriptions-item>
            <el-descriptions-item label="上级部门">
              {{
                isUnassignedDept
                  ? '—'
                  : selectedDept.parentId
                    ? getDepartmentName(scopedDepartments, selectedDept.parentId)
                    : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="部门层级">
              <el-tag size="small">{{ isUnassignedDept ? '系统部门' : deptLevelLabel }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item v-if="isUnassignedDept" label="部门说明" :span="3">
              {{ selectedDept.description || '用于管理待入职及尚未分配部门和岗位的人员' }}
            </el-descriptions-item>
            <template v-if="!isUnassignedDept">
            <el-descriptions-item label="节点类型">
              <el-tag size="small" :type="selectedDept.nodeType === 'leaf' ? 'info' : 'warning'">
                {{ nodeTypeLabel }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="考勤规则">
              <el-link v-if="selectedAttendanceGroup" type="primary" :underline="false">
                {{ selectedAttendanceGroup.name }}
              </el-link>
              <span v-else class="text-muted">未关联</span>
            </el-descriptions-item>
            <el-descriptions-item v-if="selectedAttendanceGroup" label="考勤类型">
              {{ attendanceGroupTypeMap[selectedAttendanceGroup.attendanceType] }}
            </el-descriptions-item>
            <el-descriptions-item v-if="selectedAttendanceGroup" label="考勤时段">
              {{ formatShiftPeriod(selectedAttendanceGroup) }}
            </el-descriptions-item>
            <el-descriptions-item label="负责人">
              <template v-if="managerEmployee">
                <el-avatar :size="24" class="mgr-avatar">
                  {{ managerEmployee.name[0] }}
                </el-avatar>
                {{ managerEmployee.name }}
              </template>
              <span v-else class="text-muted">未设置</span>
            </el-descriptions-item>
            <el-descriptions-item label="排序">{{ selectedDept.sort }}</el-descriptions-item>
            <el-descriptions-item label="人员规模">{{ deptEmployeeCount }} 人（本部门 {{ directEmployeeCount }} 人）</el-descriptions-item>
            </template>
          </el-descriptions>
        </div>

        <div class="page-card employee-card">
          <div class="page-header">
            <div class="section-title-wrap">
              <h3 class="section-title">员工人员</h3>
              <el-tag size="small" round>{{ employeeTableData.length }}</el-tag>
            </div>
            <el-button type="primary" @click="openCreateEmployee">+ 添加人员</el-button>
          </div>

          <div class="page-toolbar">
            <el-input
              v-model="employeeKeyword"
              placeholder="搜索姓名/工号/手机"
              clearable
              prefix-icon="Search"
              style="width: 220px"
            />
            <el-select v-model="filterStatus" clearable placeholder="状态" style="width: 120px">
              <el-option label="待入职" value="pending" />
              <el-option label="正常" value="active" />
              <el-option label="已离职" value="resigned" />
            </el-select>
            <el-button
              type="primary"
              :disabled="!selectedEmployeeIds.length"
              @click="openBatchAssign"
            >
              批量分配部门及岗位
            </el-button>
          </div>

          <el-table
            ref="employeeTableRef"
            :data="employeeTableData"
            border
            stripe
            class="employee-table"
            @selection-change="handleEmployeeSelection"
          >
            <el-table-column type="selection" width="48" />
            <el-table-column prop="employeeNo" label="工号" width="100" />
            <el-table-column prop="name" label="姓名" width="90" />
            <el-table-column label="手机号" width="120">
              <template #default="{ row }">{{ maskPhone(row.phone) }}</template>
            </el-table-column>
            <el-table-column label="身份证号" width="150">
              <template #default>330***********1234</template>
            </el-table-column>
            <el-table-column prop="position" label="岗位" width="110" />
            <el-table-column prop="hireDate" label="入职日期" width="110" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <span class="status-dot" :class="row.status" />
                <el-tag :type="statusMap[row.status as EmployeeStatus].type" size="small" effect="light">
                  {{ statusMap[row.status as EmployeeStatus].label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="是否在线" width="90">
              <template #default="{ row }">
                <span class="online-dot" :class="row.status === 'active' ? 'online' : 'offline'" />
                {{ row.status === 'active' ? '在线' : '离线' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEmployeeDetail(row)">详情</el-button>
                <el-button link type="primary" @click="openEditEmployee(row)">编辑</el-button>
                <el-button link type="danger" @click="removeEmployee(row)">移除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="64" />
            </template>
          </el-table>
        </div>
      </template>

      <div v-else class="page-card empty-panel">
        <el-empty description="请在左侧选择部门" />
      </div>
    </div>
  </div>

  <DepartmentFormDialog
    v-model:visible="deptDialogVisible"
    :editing-id="editingDeptId"
    :default-parent-id="defaultParentId"
    @saved="handleDeptSaved"
  />

  <EmployeeImportDialog
    v-model:visible="employeeImportVisible"
    :default-department-id="
      isUnassignedDept
        ? enterpriseUnassignedDepartmentId(activeEnterpriseId)
        : selectedDeptId
    "
  />

  <EmployeeBatchAssignDialog
    v-model:visible="batchAssignVisible"
    :employee-ids="selectedEmployeeIds"
    @assigned="handleBatchAssigned"
  />

  <EmployeeFormDrawer
    v-model:visible="employeeDialogVisible"
    :editing-id="editingEmployeeId"
    :default-department-id="selectedDeptId"
  />
</template>

<style scoped>
.personnel-page {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  align-items: start;
}

.empty-org-card {
  grid-column: 1 / -1;
  padding: 48px 20px;
}

.page-actions-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.page-actions-right {
  display: flex;
  gap: 10px;
}

.enterprise-tag {
  font-size: 13px;
  color: #64748b;
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  padding: 4px 12px;
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

.org-panel :deep(.el-tree) {
  background: transparent;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}

.org-panel :deep(.el-tree-node__content) {
  height: 36px;
  border-radius: 6px;
}

.org-panel :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--app-primary-light);
  color: var(--app-primary);
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
}

.org-tree-tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
  text-align: center;
}

.detail-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.dept-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.dept-title-wrap {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.dept-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #ede9fe;
  color: #5b4fdb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dept-icon--unassigned {
  background: #fef3c7;
  color: #d97706;
}

.tree-node--unassigned .tree-name {
  color: #b45309;
  font-weight: 600;
}

.unassigned-icon {
  color: #d97706;
  flex-shrink: 0;
}

.employee-card .page-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.dept-path {
  margin: 4px 0 0;
  font-size: 12px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 10px;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot,
.online-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.status-dot.active,
.online-dot.online {
  background: #22c55e;
}

.status-dot.pending {
  background: #f59e0b;
}

.status-dot.resigned,
.online-dot.offline {
  background: #94a3b8;
}

.employee-table :deep(.el-table__header th) {
  background: #fafafa;
  color: #64748b;
  font-weight: 600;
}

.dept-card-header .page-title {
  margin-bottom: 4px;
}

.dept-actions {
  display: flex;
  gap: 8px;
}

.dept-info {
  margin-top: 4px;
}

.mgr-avatar {
  vertical-align: middle;
  margin-right: 6px;
  background: var(--app-primary);
  color: #fff;
  font-size: 12px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.employee-card .page-header {
  margin-bottom: 12px;
}

.skill-tag {
  margin-right: 4px;
}

.empty-panel {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1100px) {
  .personnel-page {
    grid-template-columns: 1fr;
  }

  .org-panel {
    position: static;
  }
}
</style>
