<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  buildPermissionTree,
  dataScopeOptions,
  getAllPermissionIds,
} from '@/constants/permission'
import type { DataScopeType, SystemRole } from '@/types'

const store = useAppStore()

const selectedRoleId = ref<string | null>(store.systemRoles[0]?.id ?? null)
const configTab = ref<'function' | 'data'>('function')
const roleDialogVisible = ref(false)
const editingRoleId = ref<string | null>(null)

const checkedPermissionIds = ref<string[]>([])
const dataScope = ref<DataScopeType>('department')
const customDepartmentIds = ref<string[]>([])

const roleForm = ref({
  name: '',
  code: '',
  description: '',
  status: 'enabled' as 'enabled' | 'disabled',
})

const permissionTree = computed(() => buildPermissionTree())
const allPermissionIds = getAllPermissionIds()

const roleList = computed(() =>
  store.systemRoles.map((r) => ({
    ...r,
    statusLabel: r.status === 'enabled' ? '启用' : '停用',
    permissionCount: r.permissionIds.length,
    dataScopeLabel: dataScopeOptions.find((o) => o.value === r.dataScope)?.label ?? r.dataScope,
  })),
)

const selectedRole = computed(() =>
  store.systemRoles.find((r) => r.id === selectedRoleId.value) ?? null,
)

const departmentTree = computed(() => {
  type DeptNode = { id: string; label: string; children?: DeptNode[] }
  const build = (parentId: string | null): DeptNode[] =>
    store.departments
      .filter((d) => d.parentId === parentId)
      .sort((a, b) => a.sort - b.sort)
      .map((d) => {
        const children = build(d.id)
        return children.length ? { id: d.id, label: d.name, children } : { id: d.id, label: d.name }
      })
  return build(null)
})

function loadRoleConfig(role: SystemRole) {
  checkedPermissionIds.value = [...role.permissionIds]
  dataScope.value = role.dataScope
  customDepartmentIds.value = [...role.customDepartmentIds]
}

watch(
  selectedRoleId,
  (id) => {
    const role = store.systemRoles.find((r) => r.id === id)
    if (role) loadRoleConfig(role)
  },
  { immediate: true },
)

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
        permissionIds: ['perm_dashboard'],
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
      checkedPermissionIds.value,
      dataScope.value,
      customDepartmentIds.value,
    )
    ElMessage.success('权限配置已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

function checkAllPermissions() {
  checkedPermissionIds.value = [...allPermissionIds]
}

function clearAllPermissions() {
  checkedPermissionIds.value = ['perm_dashboard']
}

function onPermissionCheck(_node: unknown, payload: { checkedKeys: string[] }) {
  checkedPermissionIds.value = payload.checkedKeys
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
      selectedRoleId.value = store.systemRoles[0]?.id ?? null
    }
    ElMessage.success('已删除')
  } catch {
    // cancelled or error handled in store
  }
}
</script>

<template>
  <div class="page-card role-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">角色权限</h2>
        <p class="text-muted">配置后台功能权限与数据访问范围 · 共 {{ roleList.length }} 个角色</p>
      </div>
      <el-button type="primary" @click="openCreateRole">新建角色</el-button>
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
          <div class="role-meta">功能 {{ role.permissionCount }} · {{ role.dataScopeLabel }}</div>
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

        <el-tabs v-model="configTab">
          <el-tab-pane label="功能权限" name="function">
            <div class="perm-toolbar">
              <span class="text-muted">勾选该角色可访问的菜单与操作权限</span>
              <div>
                <el-button size="small" @click="checkAllPermissions">全选</el-button>
                <el-button size="small" @click="clearAllPermissions">清空</el-button>
              </div>
            </div>
            <el-tree
              :key="`perm-${selectedRoleId}`"
              :data="permissionTree"
              show-checkbox
              node-key="id"
              default-expand-all
              :props="{ label: 'name', children: 'children' }"
              :default-checked-keys="checkedPermissionIds"
              @check="onPermissionCheck"
            />
            <div class="perm-summary">
              已选 {{ checkedPermissionIds.length }} / {{ allPermissionIds.length }} 项权限
            </div>
          </el-tab-pane>

          <el-tab-pane label="数据权限" name="data">
            <p class="text-muted scope-tip">控制该角色在业务模块中可访问的数据范围</p>
            <el-radio-group v-model="dataScope" class="scope-group">
              <el-radio
                v-for="opt in dataScopeOptions"
                :key="opt.value"
                :value="opt.value"
                class="scope-radio"
              >
                <span class="scope-label">{{ opt.label }}</span>
                <span class="scope-desc">{{ opt.desc }}</span>
              </el-radio>
            </el-radio-group>

            <div v-if="dataScope === 'custom'" class="custom-dept">
              <div class="custom-dept-title">指定部门</div>
              <el-tree
                :key="`dept-${selectedRoleId}`"
                :data="departmentTree"
                show-checkbox
                node-key="id"
                default-expand-all
                :default-checked-keys="customDepartmentIds"
                @check="onDepartmentCheck"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </section>

      <el-empty v-else description="请选择或新建角色" class="role-empty" />
    </div>
  </div>

  <el-dialog
    v-model="roleDialogVisible"
    :title="editingRoleId ? '编辑角色' : '新建角色'"
    width="480px"
  >
    <el-form label-width="80px">
      <el-form-item label="角色名称" required>
        <el-input v-model="roleForm.name" placeholder="如：区域经理" />
      </el-form-item>
      <el-form-item label="角色编码" required>
        <el-input
          v-model="roleForm.code"
          placeholder="如：region_manager"
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

.perm-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.perm-summary {
  margin-top: 12px;
  font-size: 13px;
  color: #909399;
}

.scope-tip {
  margin: 0 0 16px;
}

.scope-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

.scope-radio {
  height: auto;
  align-items: flex-start;
}

.scope-radio :deep(.el-radio__label) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  white-space: normal;
  line-height: 1.4;
}

.scope-label {
  font-weight: 600;
  color: #303133;
}

.scope-desc {
  font-size: 12px;
  color: #909399;
}

.custom-dept {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed var(--app-border);
}

.custom-dept-title {
  font-weight: 600;
  margin-bottom: 12px;
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
