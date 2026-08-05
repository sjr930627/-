<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ElTree } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { formatAccountRoleNames } from '@/constants/account'
import { DEFAULT_WORKFORCE_ENTERPRISE_ID, isUnassignedDepartment } from '@/constants/department'
import {
  buildDepartmentTree,
  countDepartmentAccounts,
  getDepartmentDescendantIds,
  getDepartmentName,
} from '@/utils'
import type { DepartmentTreeNode, SystemAccount } from '@/types'

const props = withDefaults(
  defineProps<{
    scope?: 'platform' | 'enterprise'
    enterpriseId?: string
  }>(),
  { scope: 'platform' },
)

const store = useAppStore()
const treeRef = ref<InstanceType<typeof ElTree>>()
const treeKeyword = ref('')
const selectedDeptId = ref('dept_root')
const keyword = ref('')
const filterRole = ref('')
const filterStatus = ref<'all' | 'enabled' | 'disabled'>('all')
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const form = ref({
  username: '',
  displayName: '',
  phone: '',
  email: '',
  roleIds: [] as string[],
  departmentId: '',
  status: 'enabled' as 'enabled' | 'disabled',
})

interface TreeNode extends DepartmentTreeNode {
  accountCount: number
}

const scopedAccounts = computed(() => {
  if (props.scope === 'enterprise' && props.enterpriseId) {
    return store.getAccountsByEnterprise(props.enterpriseId)
  }
  return store.systemAccounts.filter(
    (a) => a.accountPortal !== 'enterprise' && !a.enterpriseId,
  )
})

const scopedDepartments = computed(() => {
  const enterpriseId =
    props.scope === 'enterprise' && props.enterpriseId
      ? props.enterpriseId
      : DEFAULT_WORKFORCE_ENTERPRISE_ID
  return store
    .getDepartmentsByEnterprise(enterpriseId)
    .filter((d) => !isUnassignedDepartment(d.id))
})

const availableRoles = computed(() => {
  if (props.scope === 'enterprise' && props.enterpriseId) {
    return store.getEnterpriseRoles(props.enterpriseId)
  }
  return store.systemRoles.filter((r) => !r.rolePortal || r.rolePortal === 'platform')
})

function enrichTree(nodes: DepartmentTreeNode[]): TreeNode[] {
  return nodes.map((node) => ({
    ...node,
    accountCount: countDepartmentAccounts(scopedDepartments.value, scopedAccounts.value, node.id, true),
    children: enrichTree(node.children),
  }))
}

onMounted(() => {
  store.syncRoleUserCounts()
  if (props.scope === 'enterprise' && props.enterpriseId) {
    store.ensureEnterpriseOrgStructure(props.enterpriseId)
  }
  const root = scopedDepartments.value.find((d) => d.parentId === null)
  selectedDeptId.value = root?.id ?? scopedDepartments.value[0]?.id ?? 'dept_root'
})

const treeData = computed(() => enrichTree(buildDepartmentTree(scopedDepartments.value)))

const selectedDept = computed(() =>
  scopedDepartments.value.find((d) => d.id === selectedDeptId.value),
)

const deptAccountCount = computed(() => {
  if (!selectedDeptId.value) return 0
  return countDepartmentAccounts(
    scopedDepartments.value,
    scopedAccounts.value,
    selectedDeptId.value,
    true,
  )
})

const enabledRoles = computed(() =>
  availableRoles.value.filter(
    (r) => r.status === 'enabled' || form.value.roleIds.includes(r.id),
  ),
)

const tableData = computed(() => {
  if (!selectedDeptId.value) return []
  const ids = getDepartmentDescendantIds(scopedDepartments.value, selectedDeptId.value)
  return scopedAccounts.value
    .filter((a) => {
      if (!ids.has(a.departmentId)) return false
      if (filterStatus.value !== 'all' && a.status !== filterStatus.value) return false
      if (filterRole.value && !a.roleIds.includes(filterRole.value)) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        a.username.toLowerCase().includes(kw) ||
        a.displayName.includes(kw) ||
        (a.phone?.includes(kw) ?? false)
      )
    })
    .map((a) => ({
      ...a,
      roleName: formatAccountRoleNames(a, availableRoles.value),
      departmentName: getDepartmentName(scopedDepartments.value, a.departmentId),
      statusLabel: a.status === 'enabled' ? '正常' : '停用',
    }))
})

watch(treeKeyword, (val) => treeRef.value?.filter(val))

function filterTreeNode(value: string, data: TreeNode) {
  if (!value) return true
  return data.name.includes(value)
}

function handleNodeClick(data: TreeNode) {
  selectedDeptId.value = data.id
}

function openCreate() {
  if (!selectedDeptId.value) {
    ElMessage.warning('请先选择部门')
    return
  }
  editingId.value = null
  form.value = {
    username: '',
    displayName: '',
    phone: '',
    email: '',
    roleIds: enabledRoles.value[0]?.id ? [enabledRoles.value[0].id] : [],
    departmentId: selectedDeptId.value,
    status: 'enabled',
  }
  dialogVisible.value = true
}

function openEdit(row: SystemAccount) {
  editingId.value = row.id
  form.value = {
    username: row.username,
    displayName: row.displayName,
    phone: row.phone ?? '',
    email: row.email ?? '',
    roleIds: [...row.roleIds],
    departmentId: row.departmentId,
    status: row.status,
  }
  dialogVisible.value = true
}

function saveAccount() {
  if (!form.value.username.trim() || !form.value.displayName.trim()) {
    ElMessage.warning('请填写登录账号和姓名')
    return
  }
  if (!form.value.roleIds.length) {
    ElMessage.warning('请至少选择一个角色')
    return
  }
  try {
    const payload = {
      username: form.value.username.trim(),
      displayName: form.value.displayName.trim(),
      phone: form.value.phone.trim() || undefined,
      email: form.value.email.trim() || undefined,
      roleIds: [...form.value.roleIds],
      departmentId: form.value.departmentId,
      accountPortal: props.scope,
      enterpriseId: props.scope === 'enterprise' ? props.enterpriseId : undefined,
      status: form.value.status,
    }
    if (editingId.value) {
      store.updateSystemAccount(editingId.value, payload)
      ElMessage.success('账号已更新')
    } else {
      store.createSystemAccount(payload)
      ElMessage.success('账号已创建，默认密码 123456')
    }
    dialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function toggleStatus(row: SystemAccount) {
  try {
    store.toggleSystemAccountStatus(row.id)
    ElMessage.success(row.status === 'enabled' ? '已停用' : '已启用')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function resetPassword(row: SystemAccount) {
  try {
    await ElMessageBox.confirm(`确定重置账号「${row.username}」的密码？`, '重置密码', {
      type: 'warning',
    })
    store.resetAccountPassword(row.id)
    ElMessage.success('密码已重置为 123456')
  } catch {
    // cancelled
  }
}

async function removeAccount(row: SystemAccount) {
  try {
    await ElMessageBox.confirm(`确定删除账号「${row.displayName}」？`, '删除账号', { type: 'warning' })
    store.removeSystemAccount(row.id)
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="ops-page">
    <div class="org-panel page-card">
      <div class="org-panel-header">
        <span class="org-title">{{ scope === 'enterprise' ? '企业组织' : '组织架构树' }}</span>
      </div>
      <el-input v-model="treeKeyword" placeholder="搜索部门" clearable prefix-icon="Search" class="org-search" />
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
            <span class="tree-count">{{ data.accountCount }}账号</span>
          </div>
        </template>
      </el-tree>
    </div>

    <div class="detail-panel page-card" v-if="selectedDept">
      <div class="page-header">
        <div>
          <h3 class="section-title">{{ selectedDept.name }}</h3>
          <p class="text-muted">含下级共 {{ deptAccountCount }} 个账号</p>
        </div>
        <el-button type="primary" @click="openCreate">新建账号</el-button>
      </div>

      <div class="page-toolbar">
        <el-input v-model="keyword" placeholder="搜索账号、姓名、手机" clearable style="width: 220px" />
        <el-select v-model="filterRole" clearable placeholder="全部角色" style="width: 140px">
          <el-option v-for="r in availableRoles" :key="r.id" :label="r.name" :value="r.id" />
        </el-select>
        <el-radio-group v-model="filterStatus">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="enabled">正常</el-radio-button>
          <el-radio-button value="disabled">停用</el-radio-button>
        </el-radio-group>
      </div>

      <el-table :data="tableData" border stripe empty-text="该部门暂无账号">
        <el-table-column prop="username" label="登录账号" width="120" />
        <el-table-column prop="displayName" label="姓名" width="100" />
        <el-table-column prop="roleName" label="角色" width="120" />
        <el-table-column prop="departmentName" label="所属部门" min-width="120" />
        <el-table-column prop="phone" label="手机" width="120" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'enabled' ? 'success' : 'info'">
              {{ row.statusLabel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" @click="resetPassword(row)">重置密码</el-button>
            <el-button v-if="!row.isSystem" link @click="toggleStatus(row)">
              {{ row.status === 'enabled' ? '停用' : '启用' }}
            </el-button>
            <el-button v-if="!row.isSystem" link type="danger" @click="removeAccount(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑账号' : '新建账号'" width="520px">
    <el-form label-width="90px">
      <el-form-item label="登录账号" required>
        <el-input v-model="form.username" :disabled="!!editingId" />
      </el-form-item>
      <el-form-item label="姓名" required>
        <el-input v-model="form.displayName" />
      </el-form-item>
      <el-form-item label="角色" required>
        <el-select v-model="form.roleIds" multiple collapse-tags collapse-tags-tooltip style="width: 100%">
          <el-option v-for="r in enabledRoles" :key="r.id" :label="r.name" :value="r.id" />
        </el-select>
        <p v-if="form.roleIds.length > 1" class="role-hint text-muted">多角色时，操作权限取各角色并集</p>
      </el-form-item>
      <el-form-item label="所属部门" required>
        <el-select v-model="form.departmentId" style="width: 100%">
          <el-option v-for="d in scopedDepartments" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="手机"><el-input v-model="form.phone" /></el-form-item>
      <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
      <el-form-item label="状态">
        <el-radio-group v-model="form.status">
          <el-radio value="enabled">正常</el-radio>
          <el-radio value="disabled">停用</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveAccount">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.ops-page {
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
  margin-bottom: 12px;
}

.org-title {
  font-weight: 600;
  font-size: 14px;
}

.org-search {
  margin-bottom: 12px;
}

.tree-node {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding-right: 8px;
  font-size: 13px;
}

.tree-count {
  font-size: 12px;
  color: #909399;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.page-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.role-hint {
  margin: 6px 0 0;
  font-size: 12px;
}

@media (max-width: 1100px) {
  .ops-page {
    grid-template-columns: 1fr;
  }
}
</style>
