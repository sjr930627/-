<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import { useAppStore } from '@/stores/app'
import {
  buildDemandOverviewTree,
  defaultDemandOverviewRange,
  gapToneClass,
  type DemandOverviewDeptRow,
  type DemandOverviewEnterpriseRow,
  type DemandOverviewSortKey,
} from '@/services/demandOverview'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { enterpriseFilter, activeEnterpriseId, showEnterpriseControl, isPlatform } =
  useEnterpriseScope('filter')

const dateRange = ref<[string, string]>(defaultDemandOverviewRange('2026-08-14'))
const attendanceGroupFilter = ref('')
const sortKey = ref<DemandOverviewSortKey>('gapCount')
const expandedIds = ref<string[]>([])
const allExpanded = ref(false)

const grabBase = computed(() =>
  route.path.startsWith('/enterprise') ? '/enterprise/grab-shifts' : '/grab-shifts',
)

const scheduleBase = computed(() =>
  route.path.startsWith('/enterprise') ? '/enterprise/schedule-manage' : '/schedule-manage',
)

const attendanceGroupOptions = computed(() =>
  store.attendanceGroups.filter((g) => g.attendanceType === 'shift' && g.status === 'enabled'),
)

const tree = computed(() =>
  buildDemandOverviewTree({
    startDate: dateRange.value?.[0] ?? '',
    endDate: dateRange.value?.[1] ?? '',
    teams: store.teams,
    departments: store.departments,
    enterprises: store.enterprises,
    attendanceGroups: store.attendanceGroups,
    holidays: store.holidays,
    plans: store.weeklyShiftDemandPlans,
    shifts: store.shifts,
    employees: store.employees,
    grabSlots: store.grabShiftSlots,
    grabApplications: store.grabShiftApplications,
    enterpriseIdFilter: activeEnterpriseId.value || undefined,
    attendanceGroupIdFilter: attendanceGroupFilter.value || undefined,
    sortKey: sortKey.value,
  }),
)

const flatRows = computed(() => {
  const rows: Array<
    | (DemandOverviewEnterpriseRow & { depth: 0 })
    | (DemandOverviewDeptRow & { depth: 1; parentId: string })
  > = []
  for (const ent of tree.value) {
    rows.push({ ...ent, depth: 0 })
    if (expandedIds.value.includes(ent.id)) {
      for (const dept of ent.children) {
        rows.push({ ...dept, depth: 1, parentId: ent.id })
      }
    }
  }
  return rows
})

const periodLabel = computed(() => {
  const [a, b] = dateRange.value ?? ['', '']
  if (!a || !b) return '—'
  return `${a} ~ ${b}`
})

const summary = computed(() => {
  const ents = tree.value
  return {
    enterprises: ents.length,
    departments: ents.reduce((s, e) => s + e.children.length, 0),
    required: ents.reduce((s, e) => s + e.requiredHeadcount, 0),
    applied: ents.reduce((s, e) => s + e.appliedCount, 0),
    gap: ents.reduce((s, e) => s + e.gapCount, 0),
  }
})

watch(
  tree,
  (list) => {
    if (!list.length) {
      expandedIds.value = []
      return
    }
    if (!isPlatform.value && list.length === 1) {
      expandedIds.value = [list[0].id]
      allExpanded.value = true
    } else if (allExpanded.value) {
      expandedIds.value = list.map((e) => e.id)
    }
  },
  { immediate: true },
)

function toggleExpand(id: string) {
  const set = new Set(expandedIds.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  expandedIds.value = [...set]
  allExpanded.value = tree.value.length > 0 && tree.value.every((e) => set.has(e.id))
}

function expandAll() {
  expandedIds.value = tree.value.map((e) => e.id)
  allExpanded.value = true
}

function collapseAll() {
  expandedIds.value = []
  allExpanded.value = false
}

function toggleExpandAll() {
  if (allExpanded.value) collapseAll()
  else expandAll()
}

function setSort(key: DemandOverviewSortKey) {
  sortKey.value = key
}

function goUrgentGrab(row: DemandOverviewEnterpriseRow | DemandOverviewDeptRow) {
  const slotId =
    row.urgentGrabSlotId ||
    row.gapShifts.find((g) => g.grabSlotId)?.grabSlotId
  if (!slotId) {
    ElMessage.info('暂无关联抢班班次，请先在抢班管理发布')
    router.push({ path: grabBase.value })
    return
  }
  router.push({ path: grabBase.value, query: { slot: slotId } })
}

function goSchedule(row: DemandOverviewEnterpriseRow | DemandOverviewDeptRow) {
  const query: Record<string, string> = {}
  if (dateRange.value?.[0]) query.date = dateRange.value[0]

  if (row.kind === 'department') {
    query.team = row.teamIds[0] ?? ''
    if (row.gapShifts[0]?.date) query.date = row.gapShifts[0].date
  } else {
    const firstTeam = row.children[0]?.teamIds[0]
    if (firstTeam) query.team = firstTeam
  }

  router.push({ path: scheduleBase.value, query })
}

function tableRowClassName({ row }: { row: { depth?: number } }) {
  return row.depth === 0 ? 'row-enterprise' : 'row-department'
}
</script>

<template>
  <div class="demand-overview">
    <header class="page-card page-header">
      <div>
        <h2 class="page-title">需求总览</h2>
        <p class="text-muted">
          企业 → 部门展开 · 需求与报名缺口一览 · 周期 {{ periodLabel }}
        </p>
      </div>
      <div class="header-stats">
        <span>组织 {{ summary.enterprises }} / 部门 {{ summary.departments }}</span>
        <span>现需求 {{ summary.required }}</span>
        <span>已报名 {{ summary.applied }}</span>
        <span class="stat-gap">缺口 {{ summary.gap }}</span>
      </div>
    </header>

    <div class="page-card toolbar">
      <EnterpriseScopeSelect
        v-if="showEnterpriseControl"
        v-model="enterpriseFilter"
        mode="filter"
        width="180px"
      />
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="周期开始"
        end-placeholder="周期结束"
        style="width: 280px"
      />
      <el-select
        v-model="attendanceGroupFilter"
        clearable
        placeholder="考勤组"
        style="width: 200px"
      >
        <el-option
          v-for="g in attendanceGroupOptions"
          :key="g.id"
          :label="g.name"
          :value="g.id"
        />
      </el-select>
      <el-button @click="toggleExpandAll">
        {{ allExpanded ? '全部折叠' : '全部展开' }}
      </el-button>
    </div>

    <div class="page-card table-card">
      <el-table
        :data="flatRows"
        border
        stripe
        row-key="id"
        :row-class-name="tableRowClassName"
      >
        <el-table-column label="组织层级" min-width="220" fixed>
          <template #default="{ row }">
            <div class="org-cell" :style="{ paddingLeft: `${row.depth * 18}px` }">
              <button
                v-if="row.kind === 'enterprise'"
                type="button"
                class="expand-btn"
                @click="toggleExpand(row.id)"
              >
                <el-icon>
                  <ArrowDown v-if="expandedIds.includes(row.id)" />
                  <ArrowRight v-else />
                </el-icon>
              </button>
              <span v-else class="expand-spacer" />
              <div>
                <strong :class="{ 'ent-name': row.kind === 'enterprise' }">
                  {{ row.kind === 'enterprise' ? row.enterpriseName : row.departmentName }}
                </strong>
                <div v-if="row.kind === 'enterprise'" class="org-sub text-muted">
                  含 {{ row.children.length }} 个部门
                </div>
                <div v-else class="org-sub text-muted">负责人 {{ row.managerName }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="总人数" width="90" align="center">
          <template #default="{ row }">{{ row.totalHeadcount }}</template>
        </el-table-column>

        <el-table-column width="110" align="center">
          <template #header>
            <button type="button" class="col-sort" @click="setSort('requiredHeadcount')">
              现需求人数
            </button>
          </template>
          <template #default="{ row }">{{ row.requiredHeadcount }}</template>
        </el-table-column>

        <el-table-column label="班次需求数" width="110" align="center">
          <template #default="{ row }">{{ row.shiftDemandCount }}</template>
        </el-table-column>

        <el-table-column label="已报名数" width="100" align="center">
          <template #default="{ row }">{{ row.appliedCount }}</template>
        </el-table-column>

        <el-table-column width="100" align="center">
          <template #header>
            <button type="button" class="col-sort" @click="setSort('gapCount')">缺口数</button>
          </template>
          <template #default="{ row }">
            <span class="gap-num" :class="gapToneClass(row.gapCount)">{{ row.gapCount }}</span>
          </template>
        </el-table-column>

        <el-table-column label="最紧急班次" min-width="180">
          <template #default="{ row }">
            <button
              v-if="row.urgentShiftLabel !== '—'"
              type="button"
              class="urgent-link"
              @click="goUrgentGrab(row)"
            >
              {{ row.urgentShiftLabel }}
            </button>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="110" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="goSchedule(row)">去排班</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!flatRows.length" description="当前周期暂无需求数据" />
    </div>
  </div>
</template>

<style scoped>
.demand-overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px;
}

.page-title {
  margin: 0 0 6px;
}

.header-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: #606266;
}

.stat-gap {
  color: #f56c6c;
  font-weight: 600;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 14px 16px;
}

.table-card {
  padding: 12px 16px 20px;
}

.org-cell {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.expand-btn {
  border: none;
  background: transparent;
  padding: 2px;
  cursor: pointer;
  color: #606266;
  display: inline-flex;
  margin-top: 2px;
}

.expand-spacer {
  width: 20px;
  flex-shrink: 0;
}

.ent-name {
  font-size: 14px;
}

.org-sub {
  font-size: 12px;
  margin-top: 2px;
}

.col-sort {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0;
}

.col-sort:hover {
  color: #409eff;
}

.gap-num {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.gap-critical {
  color: #f56c6c;
}

.gap-warning {
  color: #e6a23c;
}

.gap-ok {
  color: #67c23a;
}

.urgent-link {
  border: none;
  background: none;
  padding: 0;
  color: #409eff;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.urgent-link:hover {
  text-decoration: underline;
}

:deep(.row-enterprise) {
  background: #fafbfd !important;
}

:deep(.row-enterprise td) {
  font-weight: 500;
}
</style>
