<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { isUnassignedDepartment } from '@/constants/department'
import { formatDepartmentGap, summarizeDepartmentGaps } from '@/services/departmentGap'
import {
  buildDepartmentTree,
  getDepartmentDescendantIds,
  getDepartmentName,
} from '@/utils'
import type { DepartmentTreeNode, Employee, EmployeePersonnelCategory } from '@/types'

const store = useAppStore()
const router = useRouter()
const { enterpriseId } = useEnterpriseMiniAuth()

const personnelTab = ref<EmployeePersonnelCategory>('schedule')
const keyword = ref('')
const selectedDeptId = ref('')

const departments = computed(() => store.getDepartmentsByEnterprise(enterpriseId.value))
const employees = computed(() => store.getEmployeesByEnterprise(enterpriseId.value))

const treeData = computed(() => buildDepartmentTree(departments.value))

function matchesTab(e: Employee) {
  const category = e.personnelCategory ?? 'schedule'
  return personnelTab.value === 'grab' ? category === 'grab' : category !== 'grab'
}

function countDeptByTab(deptId: string) {
  const ids = getDepartmentDescendantIds(departments.value, deptId)
  return employees.value.filter(
    (e) =>
      (e.status === 'active' || e.status === 'pending') &&
      e.departmentId &&
      ids.has(e.departmentId) &&
      matchesTab(e),
  ).length
}

const flatDepts = computed(() => {
  const rows: { id: string; name: string; depth: number; count: number }[] = []
  const walk = (nodes: DepartmentTreeNode[], depth: number) => {
    nodes.forEach((n) => {
      rows.push({
        id: n.id,
        name: n.name,
        depth,
        count: countDeptByTab(n.id),
      })
      if (n.children?.length) walk(n.children, depth + 1)
    })
  }
  walk(treeData.value, 0)
  return rows
})

const scheduleTabCount = computed(
  () =>
    employees.value.filter(
      (e) =>
        (e.status === 'active' || e.status === 'pending') &&
        (e.personnelCategory ?? 'schedule') !== 'grab',
    ).length,
)

const poolTabCount = computed(
  () =>
    employees.value.filter(
      (e) =>
        (e.status === 'active' || e.status === 'pending') && e.personnelCategory === 'grab',
    ).length,
)

watch(
  flatDepts,
  (rows) => {
    if (!selectedDeptId.value && rows.length) selectedDeptId.value = rows[0].id
  },
  { immediate: true },
)

watch(personnelTab, () => {
  keyword.value = ''
})

const selectedDeptName = computed(() =>
  selectedDeptId.value
    ? getDepartmentName(departments.value, selectedDeptId.value)
    : '全部',
)

const isUnassignedDept = computed(() => isUnassignedDepartment(selectedDeptId.value))

const deptGap = computed(() => {
  if (!selectedDeptId.value || isUnassignedDept.value) {
    return { positionGap: 0, shiftGap: 0, total: 0 }
  }
  return summarizeDepartmentGaps({
    departmentId: selectedDeptId.value,
    departments: departments.value,
    jobRequirements: store.jobRequirements,
    grabShiftSlots: store.grabShiftSlots,
    teams: store.teams,
    attendanceGroups: store.attendanceGroups,
  })
})

const listEmployees = computed(() => {
  let list: Employee[] = employees.value.filter(
    (e) => (e.status === 'active' || e.status === 'pending') && matchesTab(e),
  )
  if (selectedDeptId.value) {
    const ids = getDepartmentDescendantIds(departments.value, selectedDeptId.value)
    list = list.filter((e) => e.departmentId && ids.has(e.departmentId))
  }
  const kw = keyword.value.trim()
  if (kw) {
    list = list.filter(
      (e) =>
        e.name.includes(kw) ||
        (e.phone ?? '').includes(kw) ||
        (e.position ?? '').includes(kw) ||
        (e.idCardNo ?? '').includes(kw),
    )
  }
  return list
    .map((e) => ({
      ...e,
      deptName: getDepartmentName(departments.value, e.departmentId),
      attendanceLabel: e.onDuty === false ? '未出勤' : '出勤',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
})

const emptyText = computed(() =>
  personnelTab.value === 'grab' ? '该部门暂无人员池人员' : '该部门暂无排班人员',
)

const searchPlaceholder = computed(() =>
  personnelTab.value === 'grab' ? '搜索姓名/手机/身份证/岗位' : '搜索姓名/手机/岗位',
)
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="人员管理" back-to="/enterprise-miniapp/attendance" />

    <div class="top-actions">
      <button type="button" class="pos-btn" @click="router.push('/enterprise-miniapp/positions')">
        岗位管理
      </button>
    </div>

    <div class="tabs">
      <button
        type="button"
        class="tab"
        :class="{ active: personnelTab === 'schedule' }"
        @click="personnelTab = 'schedule'"
      >
        排班人员
        <span class="tab-count">{{ scheduleTabCount }}</span>
      </button>
      <button
        type="button"
        class="tab"
        :class="{ active: personnelTab === 'grab' }"
        @click="personnelTab = 'grab'"
      >
        人员池
        <span class="tab-count">{{ poolTabCount }}</span>
      </button>
    </div>

    <div class="layout">
      <aside class="org">
        <div class="org-title">组织架构</div>
        <button
          v-for="d in flatDepts"
          :key="d.id"
          type="button"
          class="org-item"
          :class="{ active: selectedDeptId === d.id }"
          :style="{ paddingLeft: `${12 + d.depth * 12}px` }"
          @click="selectedDeptId = d.id"
        >
          <span class="name">{{ d.name }}</span>
          <span class="count">{{ d.count }}</span>
        </button>
        <div v-if="!flatDepts.length" class="empty-side">暂无部门</div>
      </aside>

      <section class="list">
        <div class="list-head">
          <strong>{{ selectedDeptName }}</strong>
          <span>{{ listEmployees.length }} 人</span>
        </div>
        <div v-if="selectedDeptId && !isUnassignedDept" class="dept-gap-card">
          <div class="dept-gap-row">
            <span>部门缺口</span>
            <strong :class="{ warn: deptGap.total > 0 }">{{ formatDepartmentGap(deptGap) }}</strong>
          </div>
          <p>含本部门及下属部门岗位缺口与抢班次缺口</p>
        </div>
        <input v-model="keyword" class="search" type="search" :placeholder="searchPlaceholder" />
        <div v-if="!listEmployees.length" class="empty">{{ emptyText }}</div>
        <article v-for="e in listEmployees" :key="e.id" class="card">
          <div class="avatar">{{ e.name.slice(0, 1) }}</div>
          <div class="meta">
            <div class="row">
              <strong>{{ e.name }}</strong>
              <span class="tag" :class="{ off: e.onDuty === false }">{{ e.attendanceLabel }}</span>
            </div>
            <p>{{ e.position || '未设岗位' }}{{ e.phone ? ` · ${e.phone}` : '' }}</p>
            <p class="sub">{{ e.deptName }}</p>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped>
.top-actions {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px 0;
}
.pos-btn {
  border: 1px solid #228BFF;
  background: #fff;
  color: #228BFF;
  border-radius: 999px;
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
}
.tabs {
  display: flex;
  gap: 0;
  background: #fff;
  border-bottom: 1px solid #eef2f7;
  padding: 0 8px;
}
.tab {
  flex: 1;
  border: none;
  background: transparent;
  padding: 12px 8px;
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.tab.active {
  color: #228BFF;
  font-weight: 700;
}
.tab.active::after {
  content: '';
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: 0;
  height: 2px;
  border-radius: 2px;
  background: #228BFF;
}
.tab-count {
  font-size: 11px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}
.tab.active .tab-count {
  background: #D5E9FF;
  color: #228BFF;
}
.layout {
  display: grid;
  grid-template-columns: 118px 1fr;
  gap: 0;
  min-height: calc(100vh - 140px);
  background: #fff;
}
.org {
  background: #fff;
  border-right: 1px solid #eef2f7;
  padding: 10px 0 24px;
  overflow-y: auto;
}
.org-title {
  padding: 4px 12px 10px;
  font-size: 12px;
  color: #9ca3af;
  font-weight: 600;
}
.org-item {
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 10px 10px 10px 12px;
  font-size: 12px;
  color: #4b5563;
  text-align: left;
}
.org-item.active {
  background: #D5E9FF;
  color: #228BFF;
  font-weight: 600;
}
.org-item .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.org-item .count {
  font-size: 11px;
  color: #9ca3af;
}
.list {
  padding: 10px 12px 24px;
  overflow-y: auto;
}
.list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}
.list-head strong {
  font-size: 15px;
  color: #111827;
}
.list-head span {
  font-size: 12px;
  color: #9ca3af;
}
.dept-gap-card {
  background: #fff;
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 10px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
}
.dept-gap-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.dept-gap-row span {
  font-size: 12px;
  color: #6b7280;
}
.dept-gap-row strong {
  font-size: 13px;
  color: #111827;
}
.dept-gap-row strong.warn {
  color: #d97706;
}
.dept-gap-card p {
  margin: 4px 0 0;
  font-size: 11px;
  color: #9ca3af;
}
.search {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  margin-bottom: 10px;
  background: #fff;
}
.card {
  display: flex;
  gap: 10px;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #228BFF;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}
.meta {
  min-width: 0;
  flex: 1;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.row strong {
  font-size: 14px;
  color: #111827;
}
.tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #059669;
}
.tag.off {
  background: #f3f4f6;
  color: #6b7280;
}
.meta p {
  margin: 3px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.meta .sub {
  color: #9ca3af;
}
.empty,
.empty-side {
  padding: 28px 12px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
</style>
