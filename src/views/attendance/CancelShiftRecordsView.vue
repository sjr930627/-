<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import { formatCancelShiftReason } from '@/constants/cancelShift'
import { getDepartmentName } from '@/utils'
import {
  resolveEnterpriseIdByAttendanceGroupId,
  resolveEnterpriseIdByEmployee,
} from '@/utils/enterpriseScope'
import {
  assignmentMatchesSource,
  type AttendanceAssignmentSource,
} from '@/services/attendance'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { enterpriseFilter, matchesEnterprise, enterpriseName, showEnterpriseControl } =
  useEnterpriseScope('filter')

const filterStatus = ref<'all' | 'pending' | 'approved' | 'rejected'>('all')
const keyword = ref('')

const assignmentSource = computed<AttendanceAssignmentSource>(() =>
  route.meta.assignmentSource === 'grab' ? 'grab' : 'schedule',
)

const pageTitle = computed(() =>
  assignmentSource.value === 'grab' ? '抢班取消班次记录' : '排班取消班次记录',
)

const sourceLabel = computed(() => (assignmentSource.value === 'grab' ? '抢班' : '排班'))

const parentManagePath = computed(() => {
  const isEnterprise = route.path.startsWith('/enterprise')
  if (assignmentSource.value === 'grab') {
    return isEnterprise ? '/enterprise/grab-shifts' : '/grab-shifts'
  }
  return isEnterprise ? '/enterprise/schedule-manage' : '/schedule-manage'
})

const parentManageLabel = computed(() =>
  assignmentSource.value === 'grab' ? '返回抢班管理' : '返回排班管理',
)

function goBack() {
  router.push(parentManagePath.value)
}

function matchesRecordSource(row: {
  source?: 'schedule' | 'grab'
  grabSlotId?: string
  employeeId: string
  date: string
}) {
  if (row.source) return row.source === assignmentSource.value
  if (row.grabSlotId) return assignmentSource.value === 'grab'
  return assignmentMatchesSource(
    store.getAssignment(row.employeeId, row.date),
    assignmentSource.value,
  )
}

const tableData = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return store.cancelShiftRequests
    .filter((r) => matchesRecordSource(r))
    .filter((r) => filterStatus.value === 'all' || r.status === filterStatus.value)
    .map((r) => {
      const emp = store.employees.find((e) => e.id === r.employeeId)
      const slot = r.grabSlotId
        ? store.grabShiftSlots.find((s) => s.id === r.grabSlotId)
        : undefined
      const enterpriseId = emp
        ? resolveEnterpriseIdByEmployee(emp)
        : slot
          ? resolveEnterpriseIdByAttendanceGroupId(slot.attendanceGroupId, store.attendanceGroups, store.departments)
          : ''
      return {
        ...r,
        enterpriseId,
        enterpriseName: enterpriseId ? enterpriseName(enterpriseId) : '—',
        departmentName: emp
          ? getDepartmentName(store.departments, emp.departmentId)
          : slot?.departmentName || '—',
        employeeName: emp?.name ?? (r.cancelScope === 'slot' && !r.employeeId ? '（整班）' : '—'),
        phone: emp?.phone || '—',
        shiftName:
          store.shifts.find((s) => s.id === r.shiftId)?.name ??
          slot?.shiftName ??
          '—',
        reasonDisplay: formatCancelShiftReason(r),
        scopeLabel:
          r.cancelScope === 'slot' ? '整班取消' : r.cancelScope === 'person' ? '单人取消' : '—',
        sourceLabel: r.initiatedBy === 'admin' ? '管理端' : '灵工申请',
        statusLabel: { pending: '待审批', approved: '已通过', rejected: '已驳回' }[r.status],
        createdAtLabel: new Date(r.createdAt).toLocaleString('zh-CN'),
      }
    })
    .filter((r) => matchesEnterprise(r.enterpriseId))
    .filter((r) => {
      if (!kw) return true
      return (
        r.employeeName.toLowerCase().includes(kw) ||
        r.enterpriseName.toLowerCase().includes(kw) ||
        r.departmentName.toLowerCase().includes(kw) ||
        r.reasonDisplay.toLowerCase().includes(kw) ||
        r.phone.includes(kw)
      )
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <el-button :icon="ArrowLeft" link @click="goBack">{{ parentManageLabel }}</el-button>
        <h2 class="page-title">{{ pageTitle }}</h2>
        <p class="text-muted">{{ sourceLabel }}管理 · 取消班次申请与管理端取消记录明细</p>
      </div>
      <EnterpriseScopeSelect
        v-if="showEnterpriseControl"
        v-model="enterpriseFilter"
        mode="filter"
        width="240px"
      />
    </div>

    <div class="page-toolbar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索姓名 / 企业 / 部门 / 原因"
        style="width: 260px"
      />
      <el-radio-group v-model="filterStatus">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="pending">待审批</el-radio-button>
        <el-radio-button value="approved">已通过</el-radio-button>
        <el-radio-button value="rejected">已驳回</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="tableData" border stripe empty-text="暂无取消班次记录">
      <el-table-column prop="enterpriseName" label="企业" min-width="140" show-overflow-tooltip />
      <el-table-column prop="departmentName" label="部门" min-width="120" show-overflow-tooltip />
      <el-table-column prop="employeeName" label="姓名" width="100" />
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column prop="date" label="日期" width="110" />
      <el-table-column prop="shiftName" label="班次" width="100" />
      <el-table-column
        v-if="assignmentSource === 'grab'"
        prop="scopeLabel"
        label="取消范围"
        width="100"
      />
      <el-table-column prop="reasonDisplay" label="取消原因" min-width="180" show-overflow-tooltip />
      <el-table-column prop="sourceLabel" label="来源" width="100" />
      <el-table-column prop="statusLabel" label="状态" width="90" />
      <el-table-column prop="createdAtLabel" label="发起时间" width="170" />
      <el-table-column label="审批" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <template v-if="row.reviewedAt">
            {{ row.reviewedBy || '—' }} · {{ new Date(row.reviewedAt).toLocaleString('zh-CN') }}
            <div v-if="row.reviewNote" class="text-muted">{{ row.reviewNote }}</div>
          </template>
          <span v-else class="text-muted">—</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.page-title {
  margin: 4px 0 6px;
}

.page-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
</style>
