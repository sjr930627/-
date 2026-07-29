<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ElTree } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  buildDepartmentTree,
  countDepartmentEmployees,
  getDepartmentDescendantIds,
  getDepartmentName,
} from '@/utils'
import type { DepartmentTreeNode, Employee, EmployeeStatus } from '@/types'

const store = useAppStore()
const treeRef = ref<InstanceType<typeof ElTree>>()
const treeKeyword = ref('')
const selectedDeptId = ref('dept_prod_a')
const deptDialogVisible = ref(false)
const employeeDialogVisible = ref(false)
const editingDeptId = ref<string | null>(null)
const editingEmployeeId = ref<string | null>(null)
const employeeKeyword = ref('')
const filterStatus = ref<EmployeeStatus | ''>('')

const statusMap: Record<EmployeeStatus, { label: string; type: 'success' | 'warning' | 'info' }> = {
  active: { label: '在职', type: 'success' },
  leave: { label: '休假中', type: 'warning' },
  resigned: { label: '离职', type: 'info' },
}

const deptForm = ref({
  name: '',
  parentId: null as string | null,
  sort: 0,
})

const employeeForm = ref({
  name: '',
  employeeNo: '',
  departmentId: '',
  position: '',
  hireDate: '',
  skills: [] as string[],
  preferredShiftIds: [] as string[],
  status: 'active' as EmployeeStatus,
  phone: '',
})

const skillOptions = ['叉车证', '急救证', '高级技师', '电工证', '质检员证']

interface TreeNode extends DepartmentTreeNode {
  headcount: number
}

function enrichTree(nodes: DepartmentTreeNode[]): TreeNode[] {
  return nodes.map((node) => ({
    ...node,
    headcount: countDepartmentEmployees(store.departments, store.employees, node.id, true),
    children: enrichTree(node.children),
  }))
}

const treeData = computed(() => enrichTree(buildDepartmentTree(store.departments)))

const selectedDept = computed(() =>
  store.departments.find((d) => d.id === selectedDeptId.value),
)

const deptEmployeeCount = computed(() => {
  if (!selectedDeptId.value) return 0
  return countDepartmentEmployees(
    store.departments,
    store.employees,
    selectedDeptId.value,
    true,
  )
})

const directEmployeeCount = computed(() => {
  if (!selectedDeptId.value) return 0
  return countDepartmentEmployees(
    store.departments,
    store.employees,
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
    parentId = store.departments.find((d) => d.id === parentId)?.parentId ?? null
  }
  const labels = ['一级', '二级', '三级', '四级', '五级']
  return labels[level - 1] ? `${labels[level - 1]}部门` : `${level}级部门`
})

const managerEmployee = computed(() => {
  if (!selectedDeptId.value) return null
  return (
    store.employees.find(
      (e) => e.departmentId === selectedDeptId.value && e.position.includes('组长'),
    ) ??
    store.employees.find((e) => e.departmentId === selectedDeptId.value) ??
    null
  )
})

const employeeTableData = computed(() => {
  if (!selectedDeptId.value) return []
  const ids = getDepartmentDescendantIds(store.departments, selectedDeptId.value)
  return store.employees
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
      departmentName: getDepartmentName(store.departments, e.departmentId),
      isDirect: e.departmentId === selectedDeptId.value,
    }))
})

const parentOptions = computed(() =>
  store.departments.filter((d) => d.id !== editingDeptId.value),
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
  editingDeptId.value = null
  deptForm.value = {
    name: '',
    parentId: parentId ?? selectedDeptId.value ?? null,
    sort: 0,
  }
  deptDialogVisible.value = true
}

function openEditDept() {
  if (!selectedDept.value) return
  editingDeptId.value = selectedDept.value.id
  deptForm.value = {
    name: selectedDept.value.name,
    parentId: selectedDept.value.parentId,
    sort: selectedDept.value.sort,
  }
  deptDialogVisible.value = true
}

function submitDept() {
  if (!deptForm.value.name.trim()) {
    ElMessage.warning('请输入部门名称')
    return
  }
  try {
    if (editingDeptId.value) {
      store.updateDepartment(editingDeptId.value, deptForm.value)
      ElMessage.success('部门已更新')
    } else {
      const dept = store.addDepartment(deptForm.value)
      selectedDeptId.value = dept.id
      ElMessage.success('部门已创建')
    }
    deptDialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function removeDept() {
  if (!selectedDept.value) return
  try {
    await ElMessageBox.confirm(`确定删除部门「${selectedDept.value.name}」？`, '提示', {
      type: 'warning',
    })
    const parentId = selectedDept.value.parentId
    store.removeDepartment(selectedDept.value.id)
    selectedDeptId.value = parentId ?? store.departments[0]?.id ?? ''
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
  employeeForm.value = {
    name: '',
    employeeNo: '',
    departmentId: selectedDeptId.value,
    position: '',
    hireDate: new Date().toISOString().slice(0, 10),
    skills: [],
    preferredShiftIds: [],
    status: 'active',
    phone: '',
  }
  employeeDialogVisible.value = true
}

function openEditEmployee(emp: Employee) {
  editingEmployeeId.value = emp.id
  employeeForm.value = {
    name: emp.name,
    employeeNo: emp.employeeNo,
    departmentId: emp.departmentId,
    position: emp.position,
    hireDate: emp.hireDate,
    skills: [...emp.skills],
    preferredShiftIds: [...emp.preferredShiftIds],
    status: emp.status,
    phone: emp.phone ?? '',
  }
  employeeDialogVisible.value = true
}

function submitEmployee() {
  if (!employeeForm.value.name.trim() || !employeeForm.value.employeeNo.trim()) {
    ElMessage.warning('请填写姓名和工号')
    return
  }
  const payload = { ...employeeForm.value, unavailableDates: [] as string[] }
  if (editingEmployeeId.value) {
    store.updateEmployee(editingEmployeeId.value, payload)
    ElMessage.success('人员已更新')
  } else {
    store.addEmployee(payload)
    ElMessage.success('人员已添加')
  }
  employeeDialogVisible.value = false
}

async function removeEmployee(emp: Employee) {
  await ElMessageBox.confirm(`确定删除「${emp.name}」？`, '提示', { type: 'warning' })
  store.removeEmployee(emp.id)
  ElMessage.success('已删除')
}

function maskPhone(phone?: string) {
  if (!phone) return '-'
  if (phone.includes('*')) return phone
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
</script>

<template>
  <div class="personnel-page">
    <div class="org-panel page-card">
      <div class="org-panel-header">
        <span class="org-title">组织架构树</span>
        <el-button type="primary" link @click="openCreateDept(null)">
          <el-icon><Plus /></el-icon>
        </el-button>
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
        :current-node-key="selectedDeptId"
        :expand-on-click-node="false"
        :filter-node-method="filterTreeNode"
        @node-click="handleNodeClick"
      >
        <template #default="{ data }">
          <div class="tree-node">
            <span class="tree-name">{{ data.name }}</span>
            <span class="tree-count">{{ data.headcount }}人</span>
          </div>
        </template>
      </el-tree>
      <el-button class="add-sub-btn" plain @click="openCreateDept(selectedDeptId)">
        + 新增子部门
      </el-button>
    </div>

    <div class="detail-panel">
      <template v-if="selectedDept">
        <div class="page-card dept-card">
          <div class="dept-card-header">
            <div>
              <h2 class="page-title">{{ selectedDept.name }}</h2>
              <p class="text-muted">
                含下级共 {{ deptEmployeeCount }} 人 · 本部门 {{ directEmployeeCount }} 人
              </p>
            </div>
            <div class="dept-actions">
              <el-button @click="openEditDept">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button type="danger" plain @click="removeDept">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>

          <el-descriptions :column="3" border class="dept-info">
            <el-descriptions-item label="部门名称">{{ selectedDept.name }}</el-descriptions-item>
            <el-descriptions-item label="上级部门">
              {{
                selectedDept.parentId
                  ? getDepartmentName(store.departments, selectedDept.parentId)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="部门层级">
              <el-tag size="small" type="primary">{{ deptLevelLabel }}</el-tag>
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
            <el-descriptions-item label="人员规模">{{ deptEmployeeCount }} 人</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="page-card employee-card">
          <div class="page-header">
            <div>
              <h3 class="section-title">灵工人员</h3>
              <p class="text-muted">当前部门及下级部门人员列表</p>
            </div>
            <el-button type="primary" @click="openCreateEmployee">添加人员</el-button>
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
              <el-option label="在职" value="active" />
              <el-option label="休假中" value="leave" />
              <el-option label="离职" value="resigned" />
            </el-select>
          </div>

          <el-table :data="employeeTableData" border stripe>
            <el-table-column prop="employeeNo" label="工号" width="100" />
            <el-table-column prop="name" label="姓名" width="90" />
            <el-table-column label="手机号" width="120">
              <template #default="{ row }">{{ maskPhone(row.phone) }}</template>
            </el-table-column>
            <el-table-column prop="departmentName" label="所属部门" min-width="120">
              <template #default="{ row }">
                {{ row.departmentName }}
                <el-tag v-if="!row.isDirect" size="small" type="info">下级</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="position" label="岗位" width="100" />
            <el-table-column prop="hireDate" label="入职日期" width="110" />
            <el-table-column label="技能" min-width="140">
              <template #default="{ row }">
                <el-tag v-for="s in row.skills" :key="s" size="small" class="skill-tag">
                  {{ s }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="statusMap[row.status as EmployeeStatus].type" size="small">
                  {{ statusMap[row.status as EmployeeStatus].label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEditEmployee(row)">编辑</el-button>
                <el-button link type="danger" @click="removeEmployee(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </template>

      <div v-else class="page-card empty-panel">
        <el-empty description="请在左侧选择部门" />
      </div>
    </div>
  </div>

  <el-dialog
    v-model="deptDialogVisible"
    :title="editingDeptId ? '编辑部门' : '新增部门'"
    width="480px"
  >
    <el-form label-width="90px">
      <el-form-item label="部门名称" required>
        <el-input v-model="deptForm.name" placeholder="请输入部门名称" />
      </el-form-item>
      <el-form-item label="上级部门">
        <el-select
          v-model="deptForm.parentId"
          clearable
          placeholder="无（顶级部门）"
          style="width: 100%"
        >
          <el-option v-for="d in parentOptions" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="deptForm.sort" :min="0" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="deptDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submitDept">确定</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="employeeDialogVisible"
    :title="editingEmployeeId ? '编辑人员' : '添加人员'"
    width="560px"
  >
    <el-form label-width="90px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="姓名" required>
            <el-input v-model="employeeForm.name" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="工号" required>
            <el-input v-model="employeeForm.employeeNo" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="所属部门">
            <el-select v-model="employeeForm.departmentId" style="width: 100%">
              <el-option v-for="d in store.departments" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="岗位">
            <el-input v-model="employeeForm.position" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="入职日期">
            <el-date-picker
              v-model="employeeForm.hireDate"
              type="date"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="状态">
            <el-select v-model="employeeForm.status" style="width: 100%">
              <el-option label="在职" value="active" />
              <el-option label="休假中" value="leave" />
              <el-option label="离职" value="resigned" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="技能标签">
        <el-select v-model="employeeForm.skills" multiple allow-create filterable style="width: 100%">
          <el-option v-for="s in skillOptions" :key="s" :label="s" :value="s" />
        </el-select>
      </el-form-item>
      <el-form-item label="手机号">
        <el-input v-model="employeeForm.phone" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="employeeDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submitEmployee">确定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.personnel-page {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
  align-items: start;
}

.org-panel {
  padding: 16px;
  position: sticky;
  top: 0;
}

.org-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  justify-content: space-between;
  width: 100%;
  padding-right: 8px;
  font-size: 13px;
}

.tree-count {
  font-size: 12px;
  color: #909399;
}

.add-sub-btn {
  width: 100%;
  margin-top: 12px;
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
