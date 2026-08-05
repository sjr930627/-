<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import { buildDepartmentTree } from '@/utils'
import {
  createDefaultMenuPermissions,
  dataScopeOptions,
  menuPermissionsToIds,
} from '@/constants/permission'
import { DEFAULT_WORKFORCE_ENTERPRISE_ID, isUnassignedDepartment } from '@/constants/department'
import type { DataScopeType, MenuPermissionEntry, SystemRole } from '@/types'

const store = useAppStore()
const { isPlatform, isEnterprise } = usePortal()

const platformTab = ref<'op_roles' | 'ent_roles'>('op_roles')
const selectedEnterpriseId = ref(store.enterprises[0]?.id ?? '')

const roleSource = computed(() => {
  if (isEnterprise.value) {
    return store.getEnterpriseRoles(store.currentEnterpriseId)
  }
  if (platformTab.value === 'ent_roles') {
    return store.getEnterpriseRoles(selectedEnterpriseId.value)
  }
  return store.systemRoles.filter((r) => !r.rolePortal || r.rolePortal === 'platform')
})

const selectedRoleId = ref<string | null>(roleSource.value[0]?.id ?? null)
const roleDialogVisible = ref(false)
const editingRoleId = ref<string | null>(null)
const permExpanded = ref(true)

const menuPermissions = ref<MenuPermissionEntry[]>([])
const dataScope = ref<DataScopeType>('department')
const customDepartmentIds = ref<string[]>([])

const roleForm = ref({
  name: '',
  code: '',
  description: '',
  status: 'enabled' as 'enabled' | 'disabled',
})

const currentPortal = computed(() => {
  if (isEnterprise.value) return 'enterprise' as const
  if (platformTab.value === 'ent_roles') return 'enterprise' as const
  return 'platform' as const
})

const dataScopeEnterpriseId = computed(() => {
  if (isEnterprise.value) return store.currentEnterpriseId
  if (isPlatform.value && platformTab.value === 'ent_roles') return selectedEnterpriseId.value
  return DEFAULT_WORKFORCE_ENTERPRISE_ID
})

const scopedDepartments = computed(() =>
  store
    .getDepartmentsByEnterprise(dataScopeEnterpriseId.value)
    .filter((d) => !isUnassignedDepartment(d.id)),
)

const roleList = computed(() =>
  roleSource.value.map((r) => ({
    ...r,
    statusLabel: r.status === 'enabled' ? '启用' : '停用',
    dataScopeLabel: dataScopeOptions.find((o) => o.value === r.dataScope)?.label ?? r.dataScope,
  })),
)

const selectedRole = computed(() =>
  roleSource.value.find((r) => r.id === selectedRoleId.value) ?? null,
)

const departmentTree = computed(() => {
  type DeptNode = { id: string; label: string; children?: DeptNode[] }
  const mapNode = (node: ReturnType<typeof buildDepartmentTree>[number]): DeptNode => ({
    id: node.id,
    label: node.name,
    children: node.children.length ? node.children.map(mapNode) : undefined,
  })
  return buildDepartmentTree(scopedDepartments.value).map(mapNode)
})

function loadRoleConfig(role: SystemRole) {
  menuPermissions.value = role.menuPermissions?.length
    ? role.menuPermissions.map((p) => ({ ...p }))
    : createDefaultMenuPermissions(currentPortal.value)
  dataScope.value = role.dataScope
  customDepartmentIds.value = [...role.customDepartmentIds]
}

watch(roleSource, (list) => {
  if (!list.find((r) => r.id === selectedRoleId.value)) {
    selectedRoleId.value = list[0]?.id ?? null
  }
})

watch(
  selectedRoleId,
  (id) => {
    const role = roleSource.value.find((r) => r.id === id)
    if (role) loadRoleConfig(role)
  },
  { immediate: true },
)

watch(platformTab, () => {
  selectedRoleId.value = roleSource.value[0]?.id ?? null
})

watch(selectedEnterpriseId, () => {
  if (platformTab.value === 'ent_roles') {
    selectedRoleId.value = roleSource.value[0]?.id ?? null
  }
})

function selectRole(id: string) {
  selectedRoleId.value = id
}

function openCreateRole() {
  editingRoleId.value = null
  roleForm.value = { name: '', code: '', description: '', status: 'enabled' }
  roleDialogVisible.value = true
}

function openEditRole(role: SystemRole) {
  editingRoleId.value = role.id
  roleForm.value = {
    name: role.name,
    code: role.code,
    description: role.description ?? '',
    status: role.status,
  }
  roleDialogVisible.value = true
}

function saveRoleMeta() {
  if (!roleForm.value.name.trim() || !roleForm.value.code.trim()) {
    ElMessage.warning('请填写角色名称和编码')
    return
  }
  try {
    if (editingRoleId.value) {
      store.updateSystemRole(editingRoleId.value, {
        name: roleForm.value.name.trim(),
        code: roleForm.value.code.trim(),
        description: roleForm.value.description.trim(),
        status: roleForm.value.status,
      })
      ElMessage.success('角色信息已更新')
    } else {
      const role = store.createSystemRole({
        name: roleForm.value.name.trim(),
        code: roleForm.value.code.trim(),
        description: roleForm.value.description.trim(),
        status: roleForm.value.status,
        permissionIds: menuPermissionsToIds(createDefaultMenuPermissions(currentPortal.value)),
        menuPermissions: createDefaultMenuPermissions(currentPortal.value),
        rolePortal: isEnterprise.value || platformTab.value === 'ent_roles' ? 'enterprise' : 'platform',
        enterpriseId:
          isEnterprise.value
            ? store.currentEnterpriseId
            : platformTab.value === 'ent_roles'
              ? selectedEnterpriseId.value
              : undefined,
        dataScope: 'department',
        customDepartmentIds: [],
      })
      selectedRoleId.value = role.id
      ElMessage.success('角色已创建')
    }
    roleDialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

function savePermissions() {
  if (!selectedRoleId.value) return
  if (dataScope.value === 'custom' && customDepartmentIds.value.length === 0) {
    ElMessage.warning('自定义数据范围请至少选择一个部门')
    return
  }
  try {
    store.updateRolePermissions(
      selectedRoleId.value,
      menuPermissionsToIds(menuPermissions.value),
      dataScope.value,
      customDepartmentIds.value,
      {
        menuPermissions: menuPermissions.value.map((p) => ({ ...p })),
      },
    )
    ElMessage.success('权限配置已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

function checkAllView() {
  menuPermissions.value = menuPermissions.value.map((p) => ({ ...p, view: true }))
}

function checkAllEdit() {
  menuPermissions.value = menuPermissions.value.map((p) => ({ ...p, view: true, edit: true }))
}

function clearPermissions() {
  menuPermissions.value = menuPermissions.value.map((p) => ({
    ...p,
    view: p.code === 'dashboard:view',
    edit: false,
  }))
}

function onDepartmentCheck(_node: unknown, payload: { checkedKeys: string[] }) {
  customDepartmentIds.value = payload.checkedKeys
}

async function toggleRoleStatus(role: SystemRole) {
  try {
    store.toggleSystemRoleStatus(role.id)
    ElMessage.success(role.status === 'enabled' ? '已停用' : '已启用')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function removeRole(role: SystemRole) {
  try {
    await ElMessageBox.confirm(`确定删除角色「${role.name}」？`, '删除角色', { type: 'warning' })
    store.removeSystemRole(role.id)
    if (selectedRoleId.value === role.id) {
      selectedRoleId.value = roleSource.value[0]?.id ?? null
    }
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}

const pageTitle = computed(() => (isEnterprise.value ? '权限管理' : '权限管理'))
const pageDesc = computed(() => {
  if (isEnterprise.value) return '配置本企业角色功能权限（查看/编辑）与数据访问范围'
  if (platformTab.value === 'ent_roles') {
    const ent = store.enterprises.find((e) => e.id === selectedEnterpriseId.value)
    return ent ? `企业端角色库 · ${ent.name} · 各企业独立配置` : '企业端角色库 · 各企业独立配置'
  }
  return '配置运营角色功能权限与数据范围（与企业端一致：部门/本人/自定义）'
})

function applyTemplate(templateId: string) {
  if (!selectedEnterpriseId.value) {
    ElMessage.warning('请先选择企业')
    return
  }
  try {
    store.applyRoleTemplateToEnterprise(templateId, selectedEnterpriseId.value)
    ElMessage.success('已从模板同步角色配置')
    selectedRoleId.value = roleSource.value[0]?.id ?? null
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导入失败')
  }
}
</script>

<template>
  <div class="page-card role-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ pageTitle }}</h2>
        <p class="text-muted">{{ pageDesc }} · 共 {{ roleList.length }} 个角色</p>
      </div>
      <div class="header-actions">
      <el-button type="primary" @click="openCreateRole">新建角色</el-button>
      <el-dropdown
        v-if="isPlatform && platformTab === 'ent_roles'"
        trigger="click"
        @command="applyTemplate"
      >
        <el-button>从模板导入</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="tpl in store.enterpriseRoleTemplates"
              :key="tpl.id"
              :command="tpl.id"
            >
              {{ tpl.name }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      </div>
    </div>

    <el-tabs v-if="isPlatform" v-model="platformTab" class="platform-tabs">
      <el-tab-pane label="运营角色" name="op_roles" />
      <el-tab-pane label="企业端角色库" name="ent_roles" />
    </el-tabs>

    <div v-if="isPlatform && platformTab === 'ent_roles'" class="ent-picker">
      <span class="ent-picker-label">配置企业</span>
      <el-select v-model="selectedEnterpriseId" filterable style="width: 320px">
        <el-option v-for="e in store.enterprises" :key="e.id" :label="e.name" :value="e.id" />
      </el-select>
    </div>

    <div class="role-layout">
      <aside class="role-sidebar">
        <div
          v-for="role in roleList"
          :key="role.id"
          class="role-item"
          :class="{ active: selectedRoleId === role.id }"
          @click="selectRole(role.id)"
        >
          <div class="role-item-head">
            <span class="role-name">{{ role.name }}</span>
            <el-tag size="small" :type="role.status === 'enabled' ? 'success' : 'info'">
              {{ role.statusLabel }}
            </el-tag>
          </div>
          <div class="role-meta">{{ role.code }} · {{ role.userCount }} 人</div>
          <div class="role-meta">{{ role.dataScopeLabel }}</div>
          <el-tag v-if="role.isSystem" size="small" type="warning" class="sys-tag">内置</el-tag>
        </div>
      </aside>

      <section v-if="selectedRole" class="role-config">
        <div class="config-header">
          <div>
            <h3>{{ selectedRole.name }}</h3>
            <p class="text-muted">{{ selectedRole.description || '暂无描述' }}</p>
          </div>
          <div class="config-actions">
            <el-button @click="openEditRole(selectedRole)">编辑信息</el-button>
            <el-button
              v-if="!selectedRole.isSystem"
              @click="toggleRoleStatus(selectedRole)"
            >
              {{ selectedRole.status === 'enabled' ? '停用' : '启用' }}
            </el-button>
            <el-button
              v-if="!selectedRole.isSystem"
              type="danger"
              plain
              @click="removeRole(selectedRole)"
            >
              删除
            </el-button>
            <el-button type="primary" @click="savePermissions">保存配置</el-button>
          </div>
        </div>

        <div class="perm-card data-card">
          <h4>数据权限</h4>
          <el-radio-group v-model="dataScope" class="scope-row">
            <el-radio
              v-for="opt in dataScopeOptions"
              :key="opt.value"
              :value="opt.value"
              class="scope-inline"
            >
              {{ opt.label }}
            </el-radio>
          </el-radio-group>
          <div v-if="dataScope === 'custom'" class="custom-dept">
            <el-tree
              :key="`dept-${selectedRoleId}-${dataScopeEnterpriseId}`"
              :data="departmentTree"
              show-checkbox
              node-key="id"
              default-expand-all
              :default-checked-keys="customDepartmentIds"
              @check="onDepartmentCheck"
            />
          </div>
        </div>

        <div class="perm-card function-card">
          <div class="perm-card-head">
            <h4>功能权限</h4>
            <div class="perm-toolbar-btns">
              <el-button size="small" @click="checkAllView">全选查看</el-button>
              <el-button size="small" @click="checkAllEdit">全选编辑</el-button>
              <el-button size="small" @click="clearPermissions">清空</el-button>
              <el-button size="small" text @click="permExpanded = !permExpanded">
                {{ permExpanded ? '收起' : '展开' }}
              </el-button>
            </div>
          </div>
          <el-table v-show="permExpanded" :data="menuPermissions" border size="small">
            <el-table-column prop="module" label="模块" width="140" />
            <el-table-column prop="name" label="菜单" min-width="160" />
            <el-table-column label="查看 (v)" width="100" align="center">
              <template #default="{ row }">
                <el-checkbox v-model="row.view" />
              </template>
            </el-table-column>
            <el-table-column label="编辑 (e)" width="100" align="center">
              <template #default="{ row }">
                <el-checkbox v-model="row.edit" :disabled="!row.view" @change="(v: boolean) => { if (v) row.view = true }" />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>

      <el-empty v-else description="请选择或新建角色" class="role-empty" />
    </div>
  </div>

  <el-dialog v-model="roleDialogVisible" :title="editingRoleId ? '编辑角色' : '新建角色'" width="480px">
    <el-form label-width="80px">
      <el-form-item label="角色名称" required>
        <el-input v-model="roleForm.name" placeholder="如：招聘专员" />
      </el-form-item>
      <el-form-item label="角色编码" required>
        <el-input
          v-model="roleForm.code"
          placeholder="如：recruiter"
          :disabled="!!editingRoleId && selectedRole?.isSystem"
        />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="roleForm.description" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item v-if="!selectedRole?.isSystem || !editingRoleId" label="状态">
        <el-radio-group v-model="roleForm.status">
          <el-radio value="enabled">启用</el-radio>
          <el-radio value="disabled">停用</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="roleDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveRoleMeta">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.role-page {
  min-height: calc(100vh - 140px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.platform-tabs {
  margin-bottom: 12px;
}

.ent-picker {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.ent-picker-label {
  font-size: 14px;
  color: #606266;
  white-space: nowrap;
}

.role-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
  min-height: 560px;
}

.role-sidebar {
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 8px;
  background: #fafafa;
  overflow-y: auto;
}

.role-item {
  position: relative;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 6px;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.role-item:hover {
  background: #f5f3ff;
}

.role-item.active {
  background: #ede9fe;
  border-color: #c4b5fd;
}

.role-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.role-name {
  font-weight: 600;
  font-size: 14px;
}

.role-meta {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
}

.sys-tag {
  position: absolute;
  top: 10px;
  right: 10px;
}

.role-config {
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 16px 20px;
  background: #fff;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--app-border);
}

.config-header h3 {
  margin: 0 0 4px;
  font-size: 18px;
}

.config-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.perm-card {
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

.perm-card h4 {
  margin: 0 0 12px;
  font-size: 15px;
}

.data-card {
  background: #fafbff;
}

.perm-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.perm-card-head h4 {
  margin: 0;
}

.perm-toolbar-btns {
  display: flex;
  gap: 8px;
}

.scope-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
}

.scope-inline {
  height: auto;
  margin-right: 0;
}

.partial-ent,
.custom-dept {
  margin-top: 12px;
}

.role-empty {
  border: 1px dashed var(--app-border);
  border-radius: 10px;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
