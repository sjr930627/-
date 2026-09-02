<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import OrgTreePanel, { type OrgTreeNode } from '@/components/org/OrgTreePanel.vue'
import OrgDeptEditPanel from '@/components/org/OrgDeptEditPanel.vue'
import OrgDeptBatchEditor from '@/components/org/OrgDeptBatchEditor.vue'
import {
  isUnassignedDepartment,
  isEnterpriseRootDepartment,
  enterpriseUnassignedDepartmentId,
  departmentJoinQrImageUrl,
  buildDepartmentJoinQrPayload,
} from '@/constants/department'
import { grabShiftPositionOptions } from '@/services/grabShift'
import {
  buildDepartmentTree,
  countDepartmentEmployees,
  getDepartmentDescendantIds,
  getDepartmentName,
} from '@/utils'
import { attendanceGroupTypeMap, formatShiftPeriod } from '@/constants/attendanceGroup'
import type { DepartmentTreeNode, Employee } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { enterpriseFilter, activeEnterpriseId, showEnterpriseControl } =
  useEnterpriseScope('switch')

const selectedDeptId = ref('')
const keyword = ref('')
const orgEditMode = ref(false)
const batchEditorVisible = ref(false)
const qrPreviewVisible = ref(false)
const addPersonVisible = ref(false)
const addMode = ref<'pick' | 'create'>('pick')
const pickEmployeeIds = ref<string[]>([])
const createForm = reactive({
  name: '',
  phone: '',
  employeeNo: '',
  position: '',
})

const poolCandidates = computed(() =>
  scopedEmployees.value.filter(
    (e) => e.status !== 'resigned' && e.departmentId !== selectedDeptId.value,
  ),
)

function openAddPerson() {
  if (!selectedDeptId.value || isUnassignedDept.value || isEnterpriseRootDept.value) {
    ElMessage.warning('请选择可加入人员的业务部门')
    return
  }
  addMode.value = 'pick'
  pickEmployeeIds.value = []
  createForm.name = ''
  createForm.phone = ''
  createForm.employeeNo = ''
  createForm.position = ''
  addPersonVisible.value = true
}

function confirmAddPerson() {
  if (!selectedDeptId.value) return
  try {
    if (addMode.value === 'pick') {
      if (!pickEmployeeIds.value.length) {
        ElMessage.warning('请选择人员')
        return
      }
      pickEmployeeIds.value.forEach((id) => {
        const emp = scopedEmployees.value.find((e) => e.id === id)
        store.updateEmployee(id, {
          departmentId: selectedDeptId.value,
          position: emp?.position || createForm.position || '抢班人员',
          status: 'active',
          onboardingStage: undefined,
          personnelCategory: 'grab',
        })
      })
      ElMessage.success(`已添加 ${pickEmployeeIds.value.length} 人到人员池`)
    } else {
      if (!createForm.name.trim() || !createForm.phone.trim()) {
        ElMessage.warning('请填写姓名与手机号')
        return
      }
      store.addEmployee({
        name: createForm.name.trim(),
        phone: createForm.phone.trim(),
        employeeNo: createForm.employeeNo.trim() || `P${Date.now().toString().slice(-6)}`,
        departmentId: selectedDeptId.value,
        enterpriseId: resolvedEnterpriseId.value,
        position: createForm.position.trim() || '抢班人员',
        hireDate: new Date().toISOString().slice(0, 10),
        skills: [],
        preferredShiftIds: [],
        unavailableDates: [],
        status: 'active',
        personnelCategory: 'grab',
        dataSource: 'manual',
      })
      ElMessage.success('已新增人员到人员池')
    }
    addPersonVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '添加失败')
  }
}

async function removeFromPool(row: Employee) {
  try {
    await ElMessageBox.confirm(`确定将「${row.name}」移出当前部门人员池？`, '移出人员', {
      type: 'warning',
    })
    const unassignedId = enterpriseUnassignedDepartmentId(resolvedEnterpriseId.value)
    store.updateEmployee(row.id, {
      departmentId: unassignedId,
      status: 'pending',
      onboardingStage: 'awaiting_apply',
    })
    ElMessage.success('已移出人员池')
  } catch (e) {
    if (e !== 'cancel') {
      /* ignore */
    }
  }
}

const isEnterprisePortal = computed(() => route.path.startsWith('/enterprise'))

const resolvedEnterpriseId = computed(() => {
  if (isEnterprisePortal.value) return store.currentEnterpriseId
  return activeEnterpriseId.value || store.currentEnterpriseId
})

const currentEnterprise = computed(
  () =>
    store.enterprises.find((e) => e.id === resolvedEnterpriseId.value) ?? store.currentEnterprise,
)

const scopedDepartments = computed(() =>
  store.getDepartmentsByEnterprise(resolvedEnterpriseId.value),
)
const scopedEmployees = computed(() => store.getEmployeesByEnterprise(resolvedEnterpriseId.value))

function enrichTree(nodes: DepartmentTreeNode[]): OrgTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    headcount: countDepartmentEmployees(
      scopedDepartments.value,
      scopedEmployees.value,
      node.id,
      true,
    ),
    children: enrichTree(node.children),
  }))
}

const treeData = computed(() => enrichTree(buildDepartmentTree(scopedDepartments.value)))

const lockedIds = computed(() => {
  const ids: string[] = []
  const unassigned = enterpriseUnassignedDepartmentId(resolvedEnterpriseId.value)
  if (unassigned) ids.push(unassigned)
  scopedDepartments.value.forEach((d) => {
    if (isEnterpriseRootDepartment(d) || isUnassignedDepartment(d.id)) ids.push(d.id)
  })
  return [...new Set(ids)]
})

const selectedDept = computed(
  () => scopedDepartments.value.find((d) => d.id === selectedDeptId.value) ?? null,
)

const isUnassignedDept = computed(() => isUnassignedDepartment(selectedDeptId.value))

const isEnterpriseRootDept = computed(() =>
  selectedDept.value ? isEnterpriseRootDepartment(selectedDept.value) : false,
)

const selectedLocked = computed(
  () => isUnassignedDept.value || isEnterpriseRootDept.value,
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

const selectedDeptQrUrl = computed(() => {
  if (!selectedDept.value || isUnassignedDept.value || isEnterpriseRootDept.value) return ''
  return departmentJoinQrImageUrl(resolvedEnterpriseId.value, selectedDept.value.id, 180)
})

const selectedDeptQrPayload = computed(() => {
  if (!selectedDept.value || isUnassignedDept.value || isEnterpriseRootDept.value) return ''
  return buildDepartmentJoinQrPayload(resolvedEnterpriseId.value, selectedDept.value.id)
})

watch(
  [treeData, resolvedEnterpriseId],
  ([tree]) => {
    if (!tree.length) {
      selectedDeptId.value = ''
      return
    }
    if (
      !selectedDeptId.value ||
      !scopedDepartments.value.some((d) => d.id === selectedDeptId.value)
    ) {
      selectedDeptId.value = tree[0]?.id ?? ''
    }
  },
  { immediate: true },
)

const employeeRows = computed(() => {
  if (!selectedDeptId.value) return []
  const ids = getDepartmentDescendantIds(scopedDepartments.value, selectedDeptId.value)
  const kw = keyword.value.trim().toLowerCase()
  const demoDate = '2026-07-28'
  return scopedEmployees.value
    .filter((e) => ids.has(e.departmentId))
    .filter((e) => {
      if (!kw) return true
      return (
        e.name.toLowerCase().includes(kw) ||
        (e.phone ?? '').includes(kw) ||
        (e.employeeNo ?? '').toLowerCase().includes(kw)
      )
    })
    .map((e) => {
      const punchedIn = store.punches.some(
        (p) => p.employeeId === e.id && p.date === demoDate && p.type === 'clock_in',
      )
      const punchedOut = store.punches.some(
        (p) => p.employeeId === e.id && p.date === demoDate && p.type === 'clock_out',
      )
      const onDuty = e.onDuty ?? (e.status === 'active' && punchedIn && !punchedOut)
      return {
        ...e,
        departmentName: getDepartmentName(scopedDepartments.value, e.departmentId),
        onDuty,
      }
    })
})

function onSelect(id: string) {
  selectedDeptId.value = id
}

function onAddChild(parentId: string | null) {
  try {
    const parent = parentId ? scopedDepartments.value.find((d) => d.id === parentId) : null
    if (parent?.nodeType === 'leaf') {
      ElMessage.warning('叶节点下不可创建子组织')
      return
    }
    const siblings = scopedDepartments.value.filter((d) => d.parentId === parentId)
    const item = store.addDepartment({
      name: '新建组织',
      parentId,
      sort: siblings.length + 1,
      enterpriseId: resolvedEnterpriseId.value,
      orgType: 'department',
      nodeType: 'branch',
      code: `ORG-${String(siblings.length + 1).padStart(2, '0')}`,
      description: '',
    })
    selectedDeptId.value = item.id
    orgEditMode.value = true
    batchEditorVisible.value = true
    ElMessage.success('已添加组织，请在画布中完善信息')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '添加失败')
  }
}

function onReorder(dragId: string, dropId: string, position: 'before' | 'after' | 'inner') {
  try {
    store.reorderDepartment(dragId, dropId, position)
    ElMessage.success('部门顺序已更新')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '调整失败')
  }
}

async function onRemoveDept() {
  if (!selectedDept.value) return
  try {
    await ElMessageBox.confirm(`确定删除组织「${selectedDept.value.name}」？`, '删除组织', {
      type: 'warning',
    })
    const parentId = selectedDept.value.parentId
    store.removeDepartment(selectedDept.value.id)
    selectedDeptId.value = parentId ?? treeData.value[0]?.id ?? ''
    ElMessage.success('已删除')
  } catch (e) {
    if (e !== 'cancel' && !(e instanceof Error && e.message === 'cancel')) {
      if (e instanceof Error) ElMessage.error(e.message)
    }
  }
}

function enterEditMode() {
  orgEditMode.value = true
  batchEditorVisible.value = true
}

function exitEditMode() {
  orgEditMode.value = false
}

function goEmployeeDetail(row: Employee) {
  const base = isEnterprisePortal.value ? '/enterprise/employees' : '/employees'
  router.push(`${base}/${row.id}`)
}
</script>

<template>
  <div class="pool-page">
    <header class="page-card page-header">
      <div>
        <h2 class="page-title">人员池</h2>
        <p class="text-muted">
          抢班可用人员按组织架构管理 · {{ currentEnterprise?.name ?? '—' }}
        </p>
      </div>
      <div class="header-actions">
        <EnterpriseScopeSelect
          v-if="showEnterpriseControl && !isEnterprisePortal"
          v-model="enterpriseFilter"
          mode="switch"
          width="200px"
        />
        <template v-if="orgEditMode">
          <el-button type="primary" @click="batchEditorVisible = true">组织树画布编辑</el-button>
          <el-button @click="exitEditMode">完成编辑</el-button>
        </template>
        <el-button v-else type="primary" @click="enterEditMode">编辑组织架构</el-button>
      </div>
    </header>

    <div class="org-layout">
      <div class="org-panel page-card">
        <OrgTreePanel
          :tree="treeData"
          :departments="scopedDepartments"
          :selected-id="selectedDeptId"
          :editable="orgEditMode"
          :locked-ids="lockedIds"
          @select="onSelect"
          @add-child="onAddChild"
          @reorder="onReorder"
        />
      </div>

      <div class="org-right">
        <OrgDeptEditPanel
          v-if="orgEditMode"
          class="org-side"
          :department="selectedDept"
          :departments="scopedDepartments"
          :employees="scopedEmployees"
          :locked="selectedLocked"
          @remove="onRemoveDept"
        />

        <template v-if="selectedDept && !orgEditMode">
          <div class="page-card dept-card">
            <div class="dept-card-header">
              <div class="dept-title-wrap">
                <div class="dept-icon" :class="{ 'dept-icon--unassigned': isUnassignedDept }">
                  <el-icon><User v-if="isUnassignedDept" /><OfficeBuilding v-else /></el-icon>
                </div>
                <div>
                  <h2 class="dept-title-row">
                    {{ selectedDept.name }}
                    <el-button
                      v-if="!isUnassignedDept && !isEnterpriseRootDept"
                      link
                      type="primary"
                      class="qr-btn"
                      @click="qrPreviewVisible = true"
                    >
                      入驻二维码
                    </el-button>
                  </h2>
                  <p class="text-muted dept-path">
                    <template v-if="isUnassignedDept">
                      系统默认部门 · 待申请可直接分配；已申请需审批入驻信息并分配岗位与人员 ID
                    </template>
                    <template v-else>
                      {{ currentEnterprise?.name }} /
                      {{ getDepartmentName(scopedDepartments, selectedDept.parentId ?? '') || '根节点' }}
                      / {{ selectedDept.name }}
                    </template>
                  </p>
                </div>
              </div>
              <div v-if="!isUnassignedDept && !isEnterpriseRootDept" class="dept-actions">
                <el-button plain @click="enterEditMode">编辑组织</el-button>
                <el-button plain @click="onAddChild(selectedDeptId)">添加子部门</el-button>
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
                待申请：可移出或直接分配岗位及人员 ID；已申请：审批入驻信息后分配岗位及人员 ID
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
                <el-descriptions-item label="人员规模">
                  {{ deptEmployeeCount }} 人（本部门 {{ directEmployeeCount }} 人）
                </el-descriptions-item>
              </template>
            </el-descriptions>
          </div>
        </template>

        <div v-if="selectedDept" class="page-card employee-card">
          <div class="list-head">
            <div class="section-title-wrap">
              <h3 class="section-title">员工人员</h3>
              <el-tag size="small" round>{{ employeeRows.length }}</el-tag>
            </div>
            <div class="list-actions">
              <el-input
                v-model="keyword"
                clearable
                placeholder="搜索姓名/手机号/人员 ID"
                style="width: 220px"
              />
              <el-button
                v-if="!isUnassignedDept && !isEnterpriseRootDept"
                type="primary"
                @click="openAddPerson"
              >
                + 添加人员
              </el-button>
            </div>
          </div>
          <el-table :data="employeeRows" border stripe class="employee-table">
            <el-table-column prop="name" label="姓名" width="90" />
            <el-table-column prop="phone" label="手机号" width="130">
              <template #default="{ row }">{{ row.phone || '—' }}</template>
            </el-table-column>
            <el-table-column prop="employeeNo" label="人员 ID" width="120" />
            <el-table-column prop="departmentName" label="部门" min-width="120" show-overflow-tooltip />
            <el-table-column prop="position" label="岗位" width="110" show-overflow-tooltip />
            <el-table-column prop="hireDate" label="入驻日期" width="110" />
            <el-table-column v-if="!isUnassignedDept" label="出勤情况" width="100">
              <template #default="{ row }">
                <span class="online-dot" :class="row.onDuty ? 'online' : 'offline'" />
                {{ row.onDuty ? '出勤' : '未出勤' }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag
                  size="small"
                  :type="row.status === 'active' ? 'success' : row.status === 'pending' ? 'warning' : 'info'"
                >
                  {{ row.status === 'active' ? '在职' : row.status === 'pending' ? '待入驻' : '离职' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="goEmployeeDetail(row)">详情</el-button>
                <el-button
                  v-if="!isUnassignedDept && row.departmentId === selectedDeptId"
                  link
                  type="danger"
                  @click="removeFromPool(row)"
                >
                  移出
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!employeeRows.length" description="该组织下暂无人员" />
        </div>

        <div v-if="!selectedDept" class="page-card empty-panel">
          <el-empty description="请在左侧选择部门" />
        </div>
      </div>
    </div>

    <OrgDeptBatchEditor
      v-model:visible="batchEditorVisible"
      :departments="scopedDepartments"
      :employees="scopedEmployees"
      :enterprise-id="resolvedEnterpriseId"
      :default-parent-id="selectedDeptId || null"
    />

    <el-dialog v-model="qrPreviewVisible" title="部门入驻二维码" width="360px" destroy-on-close>
      <div class="qr-preview">
        <p class="text-muted">灵工小程序扫码可申请入驻「{{ selectedDept?.name }}」</p>
        <img v-if="selectedDeptQrUrl" :src="selectedDeptQrUrl" alt="入驻二维码" class="qr-image" />
        <p class="qr-payload">{{ selectedDeptQrPayload }}</p>
      </div>
    </el-dialog>

    <el-dialog v-model="addPersonVisible" title="添加人员到人员池" width="560px" destroy-on-close>
      <el-radio-group v-model="addMode" style="margin-bottom: 14px">
        <el-radio-button value="pick">从现有人员选择</el-radio-button>
        <el-radio-button value="create">新建人员</el-radio-button>
      </el-radio-group>
      <template v-if="addMode === 'pick'">
        <el-select
          v-model="pickEmployeeIds"
          multiple
          filterable
          placeholder="选择人员"
          style="width: 100%"
        >
          <el-option
            v-for="emp in poolCandidates"
            :key="emp.id"
            :label="`${emp.name}（${emp.phone || emp.employeeNo}）· ${getDepartmentName(scopedDepartments, emp.departmentId)}`"
            :value="emp.id"
          />
        </el-select>
      </template>
      <el-form v-else label-width="88px">
        <el-form-item label="姓名" required>
          <el-input v-model="createForm.name" maxlength="20" />
        </el-form-item>
        <el-form-item label="手机号" required>
          <el-input v-model="createForm.phone" maxlength="11" />
        </el-form-item>
        <el-form-item label="人员 ID">
          <el-input v-model="createForm.employeeNo" placeholder="可不填，自动生成" />
        </el-form-item>
        <el-form-item label="岗位">
          <el-select
            v-model="createForm.position"
            filterable
            allow-create
            clearable
            placeholder="选择或输入岗位"
            style="width: 100%"
          >
            <el-option v-for="p in grabShiftPositionOptions" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addPersonVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAddPerson">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.pool-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0 0 4px;
  font-size: 20px;
}

.text-muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 0;
}

.org-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  width: 100%;
}

.org-panel {
  grid-column: 1;
  position: sticky;
  top: 16px;
  align-self: start;
  min-width: 0;
}

.org-side {
  min-width: 0;
}

.org-right {
  grid-column: 2;
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
  gap: 12px;
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

.dept-title-row {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dept-path {
  margin: 4px 0 0;
  font-size: 12px;
}

.dept-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 10px;
}

.mgr-avatar {
  vertical-align: middle;
  margin-right: 6px;
  background: var(--app-primary, #3b82f6);
  color: #fff;
  font-size: 12px;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.list-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.online-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.online-dot.online {
  background: #22c55e;
}

.online-dot.offline {
  background: #94a3b8;
}

.qr-btn {
  font-size: 13px;
  font-weight: 500;
}

.qr-preview {
  text-align: center;
}

.qr-image {
  width: 180px;
  height: 180px;
  margin: 12px auto;
  display: block;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.qr-payload {
  margin: 8px 0 0;
  font-size: 12px;
  color: #94a3b8;
  word-break: break-all;
}

.empty-panel {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1100px) {
  .org-layout {
    grid-template-columns: 1fr;
  }

  .org-panel,
  .org-right {
    grid-column: 1;
  }

  .org-panel {
    position: static;
  }
}
</style>
