<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import DepartmentFormDialog from '@/components/employee/DepartmentFormDialog.vue'
import PositionManageDialog from '@/components/employee/PositionManageDialog.vue'
import EmployeeFormDrawer from '@/components/employee/EmployeeFormDrawer.vue'
import EmployeeImportDialog from '@/components/employee/EmployeeImportDialog.vue'
import EmployeeBatchAssignDialog from '@/components/employee/EmployeeBatchAssignDialog.vue'
import OrgTreePanel, { type OrgTreeNode } from '@/components/org/OrgTreePanel.vue'
import OrgDeptBatchEditor from '@/components/org/OrgDeptBatchEditor.vue'
import {
  isUnassignedDepartment,
  isEnterpriseRootDepartment,
  enterpriseRootDepartmentId,
  enterpriseUnassignedDepartmentId,
  departmentJoinQrImageUrl,
  buildDepartmentJoinQrPayload,
  employeeDataSourceMap,
  employeeDataSourceTagType,
  resolveEmployeeDataSource,
} from '@/constants/department'
import { formatDepartmentGap, summarizeDepartmentGaps } from '@/services/departmentGap'
import {
  buildDepartmentTree,
  countDepartmentEmployees,
  getDepartmentDescendantIds,
  getDepartmentName,
} from '@/utils'
import { attendanceGroupTypeMap, formatShiftPeriod } from '@/constants/attendanceGroup'
import type { DepartmentTreeNode, Employee, EmployeeOnboardingStage, EmployeePersonnelCategory } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const selectedDeptId = ref('dept_prod_a')
const personnelTab = ref<EmployeePersonnelCategory>('schedule')
const batchEditorVisible = ref(false)
const deptDialogVisible = ref(false)
const positionManageVisible = ref(false)
const editingDeptId = ref<string | null>(null)
const defaultParentId = ref<string | null>(null)
const employeeDialogVisible = ref(false)
const employeeImportVisible = ref(false)
const batchAssignVisible = ref(false)
const assignRequireEmployeeNo = ref(false)
const assignDialogTitle = ref('批量分配部门及岗位')
const selectedEmployeeIds = ref<string[]>([])
const employeeTableRef = ref()
const editingEmployeeId = ref<string | null>(null)
const employeeKeyword = ref('')
const filterOnboarding = ref<EmployeeOnboardingStage | ''>('')
const qrPreviewVisible = ref(false)

const onboardingLabel: Record<EmployeeOnboardingStage, string> = {
  awaiting_apply: '待申请',
  applied: '已申请',
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

function enrichTree(nodes: DepartmentTreeNode[]): OrgTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    headcount: countDepartmentEmployees(scopedDepartments.value, scopedEmployees.value, node.id, true),
    children: enrichTree(node.children),
  }))
}

const treeData = computed(() => enrichTree(buildDepartmentTree(scopedDepartments.value)))

const lockedOrgIds = computed(() => {
  const ids: string[] = []
  const unassigned = enterpriseUnassignedDepartmentId(activeEnterpriseId.value)
  if (unassigned) ids.push(unassigned)
  scopedDepartments.value.forEach((d) => {
    if (isEnterpriseRootDepartment(d) || isUnassignedDepartment(d.id)) ids.push(d.id)
  })
  return [...new Set(ids)]
})

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

const deptGap = computed(() => {
  if (!selectedDeptId.value || isUnassignedDept.value) {
    return { positionGap: 0, shiftGap: 0, total: 0 }
  }
  return summarizeDepartmentGaps({
    departmentId: selectedDeptId.value,
    departments: scopedDepartments.value,
    jobRequirements: store.jobRequirements,
    grabShiftSlots: store.grabShiftSlots,
    teams: store.teams,
    attendanceGroups: store.attendanceGroups,
  })
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
  const demoDate = '2026-07-28'
  return scopedEmployees.value
    .filter((e) => {
      if (!ids.has(e.departmentId)) return false
      const category = e.personnelCategory ?? 'schedule'
      if (personnelTab.value === 'grab') {
        if (category !== 'grab') return false
      } else if (category === 'grab') {
        return false
      }
      if (employeeKeyword.value) {
        const k = employeeKeyword.value.toLowerCase()
        if (
          !e.name.includes(k) &&
          !(e.phone ?? '').includes(k) &&
          !(e.idCardNo ?? '').includes(k)
        ) {
          return false
        }
      }
      if (isUnassignedDept.value && filterOnboarding.value) {
        const stage = e.onboardingStage ?? 'awaiting_apply'
        if (stage !== filterOnboarding.value) return false
      }
      return true
    })
    .map((e) => {
      const punchedIn = store.punches.some(
        (p) => p.employeeId === e.id && p.date === demoDate && p.type === 'clock_in',
      )
      const punchedOut = store.punches.some(
        (p) => p.employeeId === e.id && p.date === demoDate && p.type === 'clock_out',
      )
      const onDuty =
        e.onDuty ?? (e.status === 'active' && punchedIn && !punchedOut)
      const grabAssignments = store.assignments.filter(
        (a) => a.employeeId === e.id && a.fromGrabSlotId,
      )
      const grabDates = grabAssignments.map((a) => a.date).sort()
      const firstWorkDate = grabDates[0] || e.hireDate || '—'
      const workCount = grabAssignments.length
        || store.punches.filter((p) => p.employeeId === e.id && p.type === 'clock_in').length
      return {
        ...e,
        departmentName: getDepartmentName(scopedDepartments.value, e.departmentId),
        isDirect: e.departmentId === selectedDeptId.value,
        onboardingStage: (e.onboardingStage ??
          (e.status === 'pending' ? 'awaiting_apply' : undefined)) as
          | EmployeeOnboardingStage
          | undefined,
        onDuty,
        applyDeptName: e.applyDepartmentId
          ? getDepartmentName(scopedDepartments.value, e.applyDepartmentId)
          : '',
        idCardDisplay: maskIdCard(e.idCardNo),
        dataSource: resolveEmployeeDataSource(e, store.workerJoinApplications),
        firstWorkDate,
        workCount,
      }
    })
})

function maskIdCard(idCard?: string) {
  if (!idCard) return '—'
  if (idCard.length < 8) return idCard
  return `${idCard.slice(0, 3)}${'*'.repeat(Math.max(0, idCard.length - 7))}${idCard.slice(-4)}`
}

const scheduleTabCount = computed(() => {
  if (!selectedDeptId.value) return 0
  const ids = getDepartmentDescendantIds(scopedDepartments.value, selectedDeptId.value)
  return scopedEmployees.value.filter(
    (e) => ids.has(e.departmentId) && (e.personnelCategory ?? 'schedule') !== 'grab',
  ).length
})

const grabTabCount = computed(() => {
  if (!selectedDeptId.value) return 0
  const ids = getDepartmentDescendantIds(scopedDepartments.value, selectedDeptId.value)
  return scopedEmployees.value.filter(
    (e) => ids.has(e.departmentId) && e.personnelCategory === 'grab',
  ).length
})

const selectedDeptQrUrl = computed(() => {
  if (!selectedDept.value || isUnassignedDept.value) return ''
  return departmentJoinQrImageUrl(activeEnterpriseId.value, selectedDept.value.id, 180)
})

const selectedDeptQrPayload = computed(() => {
  if (!selectedDept.value || isUnassignedDept.value) return ''
  return buildDepartmentJoinQrPayload(activeEnterpriseId.value, selectedDept.value.id)
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

function onOrgSelect(id: string) {
  selectedDeptId.value = id
}

function onOrgAddChild(parentId: string | null) {
  openCreateDept(parentId)
}

function onOrgReorder(dragId: string, dropId: string, position: 'before' | 'after' | 'inner') {
  try {
    store.reorderDepartment(dragId, dropId, position)
    ElMessage.success('部门顺序已更新')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '调整失败')
  }
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

function openOrgBatchEditor() {
  batchEditorVisible.value = true
}

function openEditDept() {
  if (!selectedDept.value || isUnassignedDept.value) return
  editingDeptId.value = selectedDept.value.id
  defaultParentId.value = selectedDept.value.parentId
  deptDialogVisible.value = true
}

function handleDeptSaved(deptId: string) {
  selectedDeptId.value = deptId
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

function handleEmployeeSelection(rows: Employee[]) {
  selectedEmployeeIds.value = rows.map((row) => row.id)
}

function openBatchAssign() {
  if (!selectedEmployeeIds.value.length) {
    ElMessage.warning('请先选择要分配的人员')
    return
  }
  assignRequireEmployeeNo.value = isUnassignedDept.value
  assignDialogTitle.value = isUnassignedDept.value
    ? '分配岗位及人员 ID'
    : '批量分配部门及岗位'
  batchAssignVisible.value = true
}

function openAssignOne(emp: Employee, mode: 'assign' | 'approve') {
  selectedEmployeeIds.value = [emp.id]
  assignRequireEmployeeNo.value = true
  assignDialogTitle.value = mode === 'approve' ? '审批入驻并分配' : '直接分配岗位及人员 ID'
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
        <el-button type="primary" @click="openOrgBatchEditor">编辑组织架构</el-button>
        <el-button @click="openCreateDept(null)">+ 新增部门</el-button>
        <el-button @click="positionManageVisible = true">岗位管理</el-button>
      </div>
    </div>

    <div class="org-panel page-card">
      <OrgTreePanel
        :tree="treeData"
        :departments="scopedDepartments"
        :selected-id="selectedDeptId"
        :editable="false"
        :locked-ids="lockedOrgIds"
        @select="onOrgSelect"
        @add-child="onOrgAddChild"
        @reorder="onOrgReorder"
      />
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
                <h2 class="page-title dept-title-row">
                  {{ selectedDept.name }}
                  <el-button
                    v-if="!isUnassignedDept"
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
                    {{ currentEnterprise?.name }} / {{ getDepartmentName(scopedDepartments, selectedDept.parentId ?? '') || '根节点' }} / {{ selectedDept.name }}
                  </template>
                </p>
              </div>
            </div>
            <div v-if="!isUnassignedDept && !isEnterpriseRootDept" class="dept-actions">
              <el-button plain @click="openEditDept">编辑部门</el-button>
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
            <el-descriptions-item label="人员规模">{{ deptEmployeeCount }} 人（本部门 {{ directEmployeeCount }} 人）</el-descriptions-item>
            <el-descriptions-item label="部门缺口">
              <div class="dept-gap">
                <el-tag size="small" :type="deptGap.total > 0 ? 'warning' : 'success'">
                  {{ formatDepartmentGap(deptGap) }}
                </el-tag>
                <span class="text-muted">含下属部门岗位缺口与抢班次缺口</span>
              </div>
            </el-descriptions-item>
            </template>
          </el-descriptions>
        </div>
      </template>

      <template v-if="selectedDept">
        <div class="page-card employee-card">
          <div class="page-header">
            <div class="section-title-wrap">
              <el-tabs v-model="personnelTab" class="personnel-tabs">
                <el-tab-pane name="schedule">
                  <template #label>
                    排班人员
                    <el-tag size="small" round class="tab-count">{{ scheduleTabCount }}</el-tag>
                  </template>
                </el-tab-pane>
                <el-tab-pane name="grab">
                  <template #label>
                    抢班人员
                    <el-tag size="small" round class="tab-count">{{ grabTabCount }}</el-tag>
                  </template>
                </el-tab-pane>
              </el-tabs>
            </div>
            <el-button type="primary" @click="openCreateEmployee">+ 添加人员</el-button>
          </div>

          <div class="page-toolbar">
            <el-input
              v-model="employeeKeyword"
              :placeholder="personnelTab === 'grab' ? '搜索姓名/手机/身份证' : '搜索姓名/手机'"
              clearable
              prefix-icon="Search"
              style="width: 220px"
            />
            <el-select
              v-if="isUnassignedDept && personnelTab === 'schedule'"
              v-model="filterOnboarding"
              clearable
              placeholder="入驻状态"
              style="width: 120px"
            >
              <el-option label="待申请" value="awaiting_apply" />
              <el-option label="已申请" value="applied" />
            </el-select>
            <el-button
              type="primary"
              :disabled="!selectedEmployeeIds.length"
              @click="openBatchAssign"
            >
              {{ isUnassignedDept ? '分配岗位及人员 ID' : '批量分配部门及岗位' }}
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
            <el-table-column prop="name" label="姓名" width="90" />
            <el-table-column label="手机号" width="130">
              <template #default="{ row }">{{ row.phone || '—' }}</template>
            </el-table-column>
            <el-table-column label="身份证号" width="160">
              <template #default="{ row }">{{ row.idCardDisplay }}</template>
            </el-table-column>
            <el-table-column prop="position" label="岗位" width="110" />
            <template v-if="personnelTab === 'grab'">
              <el-table-column prop="firstWorkDate" label="第一次上班时间" width="140" />
              <el-table-column prop="workCount" label="上班次数" width="100" align="center" />
            </template>
            <template v-else>
              <el-table-column prop="hireDate" label="入驻日期" width="110" />
              <el-table-column v-if="isUnassignedDept" label="入驻状态" width="100">
                <template #default="{ row }">
                  <el-tag
                    size="small"
                    :type="row.onboardingStage === 'applied' ? 'warning' : 'info'"
                  >
                    {{ onboardingLabel[(row.onboardingStage as EmployeeOnboardingStage) || 'awaiting_apply'] }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column v-if="isUnassignedDept" label="数据来源" width="110">
                <template #default="{ row }">
                  <el-tag size="small" :type="employeeDataSourceTagType[row.dataSource as keyof typeof employeeDataSourceTagType]">
                    {{ employeeDataSourceMap[row.dataSource as keyof typeof employeeDataSourceMap] }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column v-if="isUnassignedDept" label="申请部门" min-width="120">
                <template #default="{ row }">{{ row.applyDeptName || '—' }}</template>
              </el-table-column>
              <el-table-column v-if="!isUnassignedDept" label="出勤情况" width="100">
                <template #default="{ row }">
                  <span class="online-dot" :class="row.onDuty ? 'online' : 'offline'" />
                  {{ row.onDuty ? '出勤' : '未出勤' }}
                </template>
              </el-table-column>
            </template>
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="{ row }">
                <template v-if="isUnassignedDept && personnelTab === 'schedule'">
                  <el-button link type="primary" @click="openEmployeeDetail(row)">详情</el-button>
                  <el-button
                    v-if="row.onboardingStage === 'applied'"
                    link
                    type="success"
                    @click="openAssignOne(row, 'approve')"
                  >
                    审批入驻
                  </el-button>
                  <el-button
                    v-else
                    link
                    type="primary"
                    @click="openAssignOne(row, 'assign')"
                  >
                    直接分配
                  </el-button>
                  <el-button link type="danger" @click="removeEmployee(row)">移出</el-button>
                </template>
                <template v-else>
                  <el-button link type="primary" @click="openEmployeeDetail(row)">详情</el-button>
                  <el-button link type="primary" @click="openEditEmployee(row)">编辑</el-button>
                  <el-button link type="danger" @click="removeEmployee(row)">移除</el-button>
                </template>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty
                :description="personnelTab === 'grab' ? '暂无抢班人员' : '暂无排班人员'"
                :image-size="64"
              />
            </template>
          </el-table>
        </div>
      </template>

      <div v-if="!selectedDept" class="page-card empty-panel">
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

  <PositionManageDialog
    v-model:visible="positionManageVisible"
    :enterprise-id="activeEnterpriseId"
  />

  <OrgDeptBatchEditor
    v-model:visible="batchEditorVisible"
    :departments="scopedDepartments"
    :employees="scopedEmployees"
    :enterprise-id="activeEnterpriseId"
    :default-parent-id="selectedDeptId || null"
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
    :require-employee-no="assignRequireEmployeeNo"
    :title="assignDialogTitle"
    @assigned="handleBatchAssigned"
  />

  <EmployeeFormDrawer
    v-model:visible="employeeDialogVisible"
    :editing-id="editingEmployeeId"
    :default-department-id="selectedDeptId"
    :default-personnel-category="personnelTab"
  />

  <el-dialog v-model="qrPreviewVisible" title="部门入驻二维码" width="360px" destroy-on-close>
    <div class="qr-preview">
      <p class="text-muted">灵工小程序扫码可申请入驻「{{ selectedDept?.name }}」</p>
      <img v-if="selectedDeptQrUrl" :src="selectedDeptQrUrl" alt="入驻二维码" class="qr-image" />
      <p class="qr-payload">{{ selectedDeptQrPayload }}</p>
    </div>
  </el-dialog>
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

.org-panel {
  grid-column: 1;
  position: sticky;
  top: 16px;
  min-width: 0;
  align-self: start;
}

.detail-panel {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.page-actions-right {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
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

.org-tree-tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
  text-align: center;
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
  min-width: 0;
  flex: 1;
}

.personnel-tabs {
  flex: 1;
}

.personnel-tabs :deep(.el-tabs__header) {
  margin: 0;
}

.personnel-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.tab-count {
  margin-left: 6px;
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

.dept-gap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
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

.dept-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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

@media (max-width: 1100px) {
  .personnel-page {
    grid-template-columns: 1fr;
  }

  .org-panel {
    position: static;
  }
}
</style>
