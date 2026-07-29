<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ElTree } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  buildDepartmentTree,
  countDepartmentAccounts,
  getDepartmentDescendantIds,
  getDepartmentName,
} from '@/utils'
import type { DepartmentTreeNode, SystemAccount } from '@/types'

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
  roleId: '',
  departmentId: '',
  status: 'enabled' as 'enabled' | 'disabled',
})

interface TreeNode extends DepartmentTreeNode {
  accountCount: number
}

function enrichTree(nodes: DepartmentTreeNode[]): TreeNode[] {
  return nodes.map((node) => ({
    ...node,
    accountCount: countDepartmentAccounts(store.departments, store.systemAccounts, node.id, true),
    children: enrichTree(node.children),
  }))
}

onMounted(() => store.syncRoleUserCounts())

const treeData = computed(() => enrichTree(buildDepartmentTree(store.departments)))

const selectedDept = computed(() =>
  store.departments.find((d) => d.id === selectedDeptId.value),
)

const deptAccountCount = computed(() => {
  if (!selectedDeptId.value) return 0
  return countDepartmentAccounts(
    store.departments,
    store.systemAccounts,
    selectedDeptId.value,
    true,
  )
})

const directAccountCount = computed(() => {
  if (!selectedDeptId.value) return 0
  return countDepartmentAccounts(
    store.departments,
    store.systemAccounts,
    selectedDeptId.value,
    false,
  )
})

const enabledAccountCount = computed(() => {
  if (!selectedDeptId.value) return 0
  const ids = getDepartmentDescendantIds(store.departments, selectedDeptId.value)
  return store.systemAccounts.filter((a) => ids.has(a.departmentId) && a.status === 'enabled').length
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

const roleStats = computed(() => {
  if (!selectedDeptId.value) return []
  const ids = getDepartmentDescendantIds(store.departments, selectedDeptId.value)
  const map = new Map<string, number>()
  store.systemAccounts
    .filter((a) => ids.has(a.departmentId))
    .forEach((a) => {
      const roleName = store.systemRoles.find((r) => r.id === a.roleId)?.name ?? '未知角色'
      map.set(roleName, (map.get(roleName) ?? 0) + 1)
    })
  return [...map.entries()].map(([name, count]) => ({ name, count }))
})

const enabledRoles = computed(() =>
  store.systemRoles.filter((r) => r.status === 'enabled' || r.id === form.value.roleId),
)

const tableData = computed(() => {
  if (!selectedDeptId.value) return []
  const ids = getDepartmentDescendantIds(store.departments, selectedDeptId.value)
  return store.systemAccounts
    .filter((a) => {
      if (!ids.has(a.departmentId)) return false
      if (filterStatus.value !== 'all' && a.status !== filterStatus.value) return false
      if (filterRole.value && a.roleId !== filterRole.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        a.username.toLowerCase().includes(kw) ||
        a.displayName.includes(kw) ||
        (a.phone?.includes(kw) ?? false) ||
        (a.email?.toLowerCase().includes(kw) ?? false)
      )
    })
    .map((a) => {
      const role = store.systemRoles.find((r) => r.id === a.roleId)
      return {
        ...a,
        roleName: role?.name ?? '-',
        departmentName: getDepartmentName(store.departments, a.departmentId),
        statusLabel: a.status === 'enabled' ? '正常' : '停用',
        isDirect: a.departmentId === selectedDeptId.value,
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
})

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

function openCreate() {
  if (!selectedDeptId.value) {
    ElMessage.warning('请先选择部门')
    return
  }
  const defaultDept =
    selectedDeptId.value === 'dept_root'
      ? store.departments.find((d) => d.parentId === 'dept_root')?.id ?? 'dept_hr'
      : selectedDeptId.value
  editingId.value = null
  form.value = {
    username: '',
    displayName: '',
    phone: '',
    email: '',
    roleId: enabledRoles.value[0]?.id ?? '',
    departmentId: defaultDept,
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
    roleId: row.roleId,
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
  if (!form.value.roleId || !form.value.departmentId) {
    ElMessage.warning('请选择角色和所属部门')
    return
  }
  try {
    const payload = {
      username: form.value.username.trim(),
      displayName: form.value.displayName.trim(),
      phone: form.value.phone.trim() || undefined,
      email: form.value.email.trim() || undefined,
      roleId: form.value.roleId,
      departmentId: form.value.departmentId,
      status: form.value.status,
    }
    if (editingId.value) {
      const account = store.systemAccounts.find((a) => a.id === editingId.value)
      store.updateSystemAccount(editingId.value, {
        ...payload,
        ...(account?.isSystem ? { status: account.status } : {}),
      })
      ElMessage.success('账号已更新')
    } else {
      store.createSystemAccount(payload)
      ElMessage.success('账号已创建，默认密码：123456（演示）')
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
    ElMessage.success('密码已重置为 123456（演示）')
  } catch {
    // cancelled
  }
}

async function removeAccount(row: SystemAccount) {
  try {
    await ElMessageBox.confirm(`确定删除账号「${row.displayName}（${row.username}）」？`, '删除账号', {
      type: 'warning',
    })
    store.removeSystemAccount(row.id)
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}

function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}

function maskPhone(phone?: string) {
  if (!phone) return '—'
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
</script>

<template>
  <div class="account-page">
    <div class="org-panel page-card">
      <div class="org-panel-header">
        <span class="org-title">组织架构树</span>
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
            <span class="tree-count">{{ data.accountCount }}账号</span>
          </div>
        </template>
      </el-tree>
    </div>

    <div class="detail-panel">
      <template v-if="selectedDept">
        <div class="page-card dept-card">
          <div class="dept-card-header">
            <div>
              <h2 class="page-title">{{ selectedDept.name }}</h2>
              <p class="text-muted">
                含下级共 {{ deptAccountCount }} 个账号 · 本部门 {{ directAccountCount }} 个 · 正常
                {{ enabledAccountCount }} 个
              </p>
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
            <el-descriptions-item label="账号规模">{{ deptAccountCount }} 个</el-descriptions-item>
            <el-descriptions-item label="本部门账号">{{ directAccountCount }} 个</el-descriptions-item>
            <el-descriptions-item label="正常账号">{{ enabledAccountCount }} 个</el-descriptions-item>
            <el-descriptions-item label="角色分布" :span="3">
              <template v-if="roleStats.length">
                <el-tag v-for="item in roleStats" :key="item.name" size="small" class="role-tag">
                  {{ item.name }} {{ item.count }}
                </el-tag>
              </template>
              <span v-else class="text-muted">暂无账号</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="page-card account-card">
          <div class="page-header">
            <div>
              <h3 class="section-title">后台账号</h3>
              <p class="text-muted">当前部门及下级部门登录账号</p>
            </div>
            <el-button type="primary" @click="openCreate">新建账号</el-button>
          </div>

          <div class="page-toolbar">
            <el-input
              v-model="keyword"
              placeholder="搜索账号、姓名、手机、邮箱"
              clearable
              prefix-icon="Search"
              style="width: 240px"
            />
            <el-select v-model="filterRole" clearable placeholder="全部角色" style="width: 140px">
              <el-option v-for="r in store.systemRoles" :key="r.id" :label="r.name" :value="r.id" />
            </el-select>
            <el-radio-group v-model="filterStatus">
              <el-radio-button value="all">全部</el-radio-button>
              <el-radio-button value="enabled">正常</el-radio-button>
              <el-radio-button value="disabled">停用</el-radio-button>
            </el-radio-group>
          </div>

          <el-table :data="tableData" border stripe empty-text="该部门暂无账号">
            <el-table-column prop="username" label="登录账号" width="120" />
            <el-table-column label="姓名" width="100">
              <template #default="{ row }">
                <div class="name-cell">
                  <el-avatar :size="24" class="acc-avatar">{{ row.displayName[0] }}</el-avatar>
                  {{ row.displayName }}
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="roleName" label="角色" width="120" />
            <el-table-column prop="departmentName" label="所属部门" min-width="120">
              <template #default="{ row }">
                {{ row.departmentName }}
                <el-tag v-if="!row.isDirect" size="small" type="info">下级</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="手机" width="120">
              <template #default="{ row }">{{ maskPhone(row.phone) }}</template>
            </el-table-column>
            <el-table-column prop="email" label="邮箱" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">{{ row.email ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
                  {{ row.statusLabel }}
                </el-tag>
                <el-tag v-if="row.isSystem" size="small" type="warning" style="margin-left: 4px">
                  内置
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="最后登录" width="165">
              <template #default="{ row }">{{ formatTime(row.lastLoginAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
                <el-button link type="primary" @click="resetPassword(row)">重置密码</el-button>
                <el-button v-if="!row.isSystem" link @click="toggleStatus(row)">
                  {{ row.status === 'enabled' ? '停用' : '启用' }}
                </el-button>
                <el-button v-if="!row.isSystem" link type="danger" @click="removeAccount(row)">
                  删除
                </el-button>
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
    v-model="dialogVisible"
    :title="editingId ? '编辑账号' : '新建账号'"
    width="520px"
    destroy-on-close
  >
    <el-form label-width="90px">
      <el-form-item label="登录账号" required>
        <el-input
          v-model="form.username"
          placeholder="英文字母、数字、下划线"
          :disabled="!!editingId && store.systemAccounts.find((a) => a.id === editingId)?.isSystem"
        />
      </el-form-item>
      <el-form-item label="姓名" required>
        <el-input v-model="form.displayName" placeholder="显示名称" />
      </el-form-item>
      <el-form-item label="角色" required>
        <el-select v-model="form.roleId" style="width: 100%">
          <el-option
            v-for="r in enabledRoles"
            :key="r.id"
            :label="r.name"
            :value="r.id"
            :disabled="r.status === 'disabled'"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="所属部门" required>
        <el-select v-model="form.departmentId" style="width: 100%">
          <el-option
            v-for="d in store.departments.filter((dep) => dep.id !== 'dept_root')"
            :key="d.id"
            :label="d.name"
            :value="d.id"
          />
        </el-select>
        <p class="field-tip">用于数据权限范围判定（与角色数据权限配合）</p>
      </el-form-item>
      <el-form-item label="手机">
        <el-input v-model="form.phone" placeholder="选填" />
      </el-form-item>
      <el-form-item label="邮箱">
        <el-input v-model="form.email" placeholder="选填" />
      </el-form-item>
      <el-form-item
        v-if="!editingId || !store.systemAccounts.find((a) => a.id === editingId)?.isSystem"
        label="状态"
      >
        <el-radio-group v-model="form.status">
          <el-radio value="enabled">正常</el-radio>
          <el-radio value="disabled">停用</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-alert
        v-if="!editingId"
        type="info"
        :closable="false"
        title="新建账号默认密码为 123456（演示环境）"
        style="margin-top: 8px"
      />
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveAccount">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.account-page {
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
  max-height: calc(100vh - 240px);
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

.dept-info {
  margin-top: 4px;
}

.role-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.account-card .page-header {
  margin-bottom: 12px;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.acc-avatar {
  background: var(--app-primary);
  color: #fff;
  font-size: 12px;
  flex-shrink: 0;
}

.empty-panel {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.field-tip {
  margin: 6px 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}

@media (max-width: 1100px) {
  .account-page {
    grid-template-columns: 1fr;
  }

  .org-panel {
    position: static;
  }
}
</style>
