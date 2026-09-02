<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  defaultEnterpriseModules,
  enterpriseModuleMap,
  formatEnterpriseOwnerNames,
  getEnterpriseOwnerIds,
  getTenantModuleTags,
  isTenantActive,
  normalizeEnterpriseModules,
  tenantStatusMeta,
} from '@/constants/enterprise'
import type { Enterprise, EnterpriseServiceModule } from '@/types'

const emit = defineEmits<{
  editAccounts: [enterpriseId: string]
}>()

const store = useAppStore()
const router = useRouter()

const keywordName = ref('')
const keywordContact = ref('')
const statusFilter = ref<'all' | 'active' | 'disabled'>('all')

const tenantDialogVisible = ref(false)
const moduleDialogVisible = ref(false)
const editingTenantId = ref<string | null>(null)
const moduleTargetId = ref<string | null>(null)

const tenantForm = ref({
  name: '',
  shortName: '',
  contactPerson: '',
  contactPhone: '',
  creditCode: '',
  address: '',
  enterpriseOwnerIds: [] as string[],
  serviceModules: [...defaultEnterpriseModules] as EnterpriseServiceModule[],
  adminName: '',
  adminPhone: '',
})

const moduleForm = ref<EnterpriseServiceModule[]>([])

const moduleOptions: { key: EnterpriseServiceModule; label: string; disabled?: boolean }[] = [
  { key: 'attendance', label: enterpriseModuleMap.attendance, disabled: true },
  { key: 'payroll', label: enterpriseModuleMap.payroll, disabled: true },
  { key: 'recruitment', label: enterpriseModuleMap.recruitment },
  { key: 'task', label: enterpriseModuleMap.task },
  { key: 'training', label: enterpriseModuleMap.training },
]

const tableData = computed(() =>
  store.enterprises
    .filter((e) => {
      if (statusFilter.value === 'active' && !isTenantActive(e)) return false
      if (statusFilter.value === 'disabled' && isTenantActive(e)) return false
      if (keywordName.value.trim()) {
        const kw = keywordName.value.trim()
        if (!e.name.includes(kw) && !e.code.includes(kw)) return false
      }
      if (keywordContact.value.trim()) {
        const kw = keywordContact.value.trim()
        if (!e.contactPerson.includes(kw)) return false
      }
      return true
    })
    .map((e) => ({
      ...e,
      ownerLabel: formatEnterpriseOwnerNames(getEnterpriseOwnerIds(e), store.systemAccounts),
      moduleTags: getTenantModuleTags(e.serviceModules),
      tenantActive: isTenantActive(e),
      statusLabel: isTenantActive(e) ? tenantStatusMeta.active.label : tenantStatusMeta.disabled.label,
      statusDot: isTenantActive(e) ? tenantStatusMeta.active.dot : tenantStatusMeta.disabled.dot,
    })),
)

function resetFilters() {
  keywordName.value = ''
  keywordContact.value = ''
  statusFilter.value = 'all'
}

function openCreate() {
  editingTenantId.value = null
  tenantForm.value = {
    name: '',
    shortName: '',
    contactPerson: '',
    contactPhone: '',
    creditCode: '',
    address: '',
    enterpriseOwnerIds: [],
    serviceModules: [...defaultEnterpriseModules],
    adminName: '',
    adminPhone: '',
  }
  tenantDialogVisible.value = true
}

function saveTenant() {
  if (!tenantForm.value.name.trim() || !tenantForm.value.contactPerson.trim()) {
    ElMessage.warning('请填写企业名称和联系人')
    return
  }
  try {
    const adminAccount = tenantForm.value.adminPhone.trim()
      ? {
          name: tenantForm.value.adminName.trim() || tenantForm.value.contactPerson.trim(),
          phone: tenantForm.value.adminPhone.trim(),
          role: '企业管理员',
          passwordMode: 'auto' as const,
          initialPassword: '123456',
        }
      : undefined

    if (editingTenantId.value) {
      store.updateEnterprise(editingTenantId.value, {
        name: tenantForm.value.name.trim(),
        shortName: tenantForm.value.shortName.trim() || tenantForm.value.name.trim(),
        contactPerson: tenantForm.value.contactPerson.trim(),
        contactPhone: tenantForm.value.contactPhone.trim(),
        creditCode: tenantForm.value.creditCode.trim(),
        address: tenantForm.value.address.trim() || undefined,
        enterpriseOwnerIds: tenantForm.value.enterpriseOwnerIds,
        serviceModules: normalizeEnterpriseModules(tenantForm.value.serviceModules),
        adminAccount,
      })
      const ent = store.enterprises.find((e) => e.id === editingTenantId.value)
      if (ent && adminAccount) store.ensureEnterpriseAdminAccount(ent)
      ElMessage.success('租户信息已更新')
    } else {
      const shortName =
        tenantForm.value.shortName.trim() || tenantForm.value.name.trim().slice(0, 6)
      const logoLabel = shortName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').slice(0, 2) || '企'
      const logoUrl = `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="28" fill="#5b4fdb"/><text x="80" y="96" text-anchor="middle" fill="#fff" font-size="48" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-weight="700">${logoLabel}</text></svg>`,
      )}`
      const ent = store.addEnterprise({
        name: tenantForm.value.name.trim(),
        shortName,
        contactPerson: tenantForm.value.contactPerson.trim(),
        contactPhone: tenantForm.value.contactPhone.trim(),
        creditCode: tenantForm.value.creditCode.trim() || '91330000MA0000000X',
        address: tenantForm.value.address.trim() || undefined,
        logoUrl,
        enterpriseOwnerIds: tenantForm.value.enterpriseOwnerIds,
        serviceModules: normalizeEnterpriseModules(tenantForm.value.serviceModules),
        adminAccount,
      })
      store.ensureEnterpriseOrgStructure(ent.id)
      if (adminAccount) store.ensureEnterpriseAdminAccount(ent)
      ElMessage.success('租户已创建，默认管理员密码 123456')
    }
    tenantDialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

function enterAccountMgmt(row: Enterprise) {
  emit('editAccounts', row.id)
}

function openModuleAuth(row: Enterprise) {
  moduleTargetId.value = row.id
  moduleForm.value = normalizeEnterpriseModules([...row.serviceModules])
  moduleDialogVisible.value = true
}

function saveModuleAuth() {
  if (!moduleTargetId.value) return
  store.updateEnterpriseModules(moduleTargetId.value, moduleForm.value)
  ElMessage.success('模块授权已更新')
  moduleDialogVisible.value = false
}

async function resetPassword(row: Enterprise) {
  try {
    await ElMessageBox.confirm(`确定重置「${row.name}」管理员登录密码？`, '重置密码', {
      type: 'warning',
    })
    const acc = store.resetEnterpriseTenantPassword(row.id)
    ElMessage.success(`已重置为 123456（账号：${acc.username}）`)
  } catch (e) {
    if (e instanceof Error && e.message !== 'cancel') {
      ElMessage.error(e.message)
    }
  }
}

async function toggleTenant(row: Enterprise) {
  try {
    const action = isTenantActive(row) ? '停用' : '启用'
    await ElMessageBox.confirm(`确定${action}租户「${row.name}」？`, `${action}租户`, {
      type: 'warning',
    })
    store.toggleEnterpriseTenantStatus(row.id)
    ElMessage.success(`已${action}`)
  } catch {
    // cancelled
  }
}

function viewEnterprise(row: Enterprise) {
  router.push(`/enterprises/${row.id}`)
}
</script>

<template>
  <div class="tenant-tab">
    <div class="filter-bar">
      <el-input v-model="keywordName" placeholder="请输入企业名称" clearable style="width: 200px" />
      <el-input v-model="keywordContact" placeholder="请输入联系人" clearable style="width: 160px" />
      <el-select v-model="statusFilter" style="width: 120px">
        <el-option label="全部" value="all" />
        <el-option label="正常" value="active" />
        <el-option label="已停用" value="disabled" />
      </el-select>
      <el-button type="primary" @click="() => {}">
        <el-icon><Search /></el-icon>
        搜索
      </el-button>
      <el-button @click="resetFilters">
        <el-icon><RefreshLeft /></el-icon>
        重置
      </el-button>
      <div class="filter-spacer" />
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新增租户
      </el-button>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="企业名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="code" label="企业编号" width="150" />
      <el-table-column prop="contactPerson" label="联系人" width="100" />
      <el-table-column prop="contactPhone" label="联系电话" width="130" />
      <el-table-column prop="ownerLabel" label="负责运营" min-width="120" show-overflow-tooltip />
      <el-table-column label="入驻状态" width="100">
        <template #default="{ row }">
          <span class="status-dot" :style="{ background: row.statusDot }" />
          {{ row.statusLabel }}
        </template>
      </el-table-column>
      <el-table-column label="可用模块" min-width="200">
        <template #default="{ row }">
          <el-tag v-for="tag in row.moduleTags" :key="tag" size="small" type="primary" class="mod-tag">
            {{ tag }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="viewEnterprise(row)">查看</el-button>
          <el-button link type="primary" @click="enterAccountMgmt(row)">编辑</el-button>
          <el-button link type="primary" @click="openModuleAuth(row)">模块授权</el-button>
          <el-button link type="primary" @click="resetPassword(row)">重置密码</el-button>
          <el-button
            link
            :type="row.tenantActive ? 'danger' : 'primary'"
            @click="toggleTenant(row)"
          >
            {{ row.tenantActive ? '停用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog
    v-model="tenantDialogVisible"
    :title="editingTenantId ? '编辑租户' : '新增租户'"
    width="560px"
    destroy-on-close
  >
    <el-form label-width="100px">
      <el-form-item label="企业名称" required>
        <el-input v-model="tenantForm.name" placeholder="如：中国移动北京朝阳分公司" />
      </el-form-item>
      <el-form-item label="企业简称">
        <el-input v-model="tenantForm.shortName" placeholder="选填" />
      </el-form-item>
      <el-form-item label="联系人" required>
        <el-input v-model="tenantForm.contactPerson" />
      </el-form-item>
      <el-form-item label="联系电话">
        <el-input v-model="tenantForm.contactPhone" />
      </el-form-item>
      <el-form-item label="统一社会信用代码">
        <el-input v-model="tenantForm.creditCode" />
      </el-form-item>
      <el-form-item label="管理员姓名">
        <el-input v-model="tenantForm.adminName" placeholder="企业端初始管理员" />
      </el-form-item>
      <el-form-item label="管理员手机">
        <el-input v-model="tenantForm.adminPhone" placeholder="用于登录企业端" />
      </el-form-item>
      <el-form-item label="负责运营">
        <el-select v-model="tenantForm.enterpriseOwnerIds" multiple style="width: 100%">
          <el-option
            v-for="a in store.systemAccounts.filter((x) => !x.enterpriseId)"
            :key="a.id"
            :label="a.displayName"
            :value="a.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="开通模块">
        <el-checkbox-group v-model="tenantForm.serviceModules">
          <el-checkbox
            v-for="opt in moduleOptions"
            :key="opt.key"
            :value="opt.key"
            :disabled="opt.disabled"
          >
            {{ opt.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="tenantDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveTenant">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="moduleDialogVisible" title="模块授权" width="480px">
    <p class="text-muted">按企业端一/二级菜单勾选开通模块</p>
    <el-checkbox-group v-model="moduleForm">
      <div v-for="opt in moduleOptions" :key="opt.key" class="module-row">
        <el-checkbox :value="opt.key" :disabled="opt.disabled">{{ opt.label }}</el-checkbox>
      </div>
    </el-checkbox-group>
    <template #footer>
      <el-button @click="moduleDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveModuleAuth">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}

.filter-spacer {
  flex: 1;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.mod-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}

.module-row {
  padding: 6px 0;
}
</style>
