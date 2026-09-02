<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  attendanceGroupStatusMap,
  attendanceGroupTypeMap,
  formatDeptBindings,
  formatMinMonthlyHours,
  formatShiftPeriod,
  formatVersionLabel,
} from '@/constants/attendanceGroup'
import type { AttendanceGroup, AttendanceGroupType } from '@/types'

const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const statusFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const typeFilter = ref<'all' | AttendanceGroupType>('all')

const groups = computed(() =>
  store
    .getAttendanceGroupsByEnterprise(enterpriseId.value)
    .filter((g) => {
      if (statusFilter.value !== 'all' && g.status !== statusFilter.value) return false
      if (typeFilter.value !== 'all' && g.attendanceType !== typeFilter.value) return false
      return true
    })
    .map((g) => {
      const depts = formatDeptBindings(g.departmentBindings)
      return {
        ...g,
        typeLabel: attendanceGroupTypeMap[g.attendanceType],
        statusLabel: attendanceGroupStatusMap[g.status],
        shiftPeriod: formatShiftPeriod(g),
        minMonthlyLabel: formatMinMonthlyHours(g.minMonthlyOnlineHours),
        versionLabel:
          g.currentVersion > 0 ? formatVersionLabel(g.currentVersion) : '未发布',
        deptTags: depts.visible,
        deptExtra: depts.extra,
      }
    }),
)

function openCreate() {
  router.push('/enterprise-miniapp/attendance-groups/create')
}

function openDetail(id: string) {
  router.push(`/enterprise-miniapp/attendance-groups/${id}`)
}

async function toggleStatus(group: AttendanceGroup) {
  store.toggleAttendanceGroupStatus(group.id)
  ElMessage.success(group.status === 'enabled' ? '已停用' : '已启用')
}

async function removeGroup(group: AttendanceGroup) {
  try {
    await ElMessageBox.confirm(`确定删除考勤组「${group.name}」？`, '提示', { type: 'warning' })
    store.removeAttendanceGroup(group.id)
    ElMessage.success('已删除')
  } catch {
    /* cancelled */
  }
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="考勤组配置" back-to="/enterprise-miniapp/attendance" />

    <p class="page-desc">点击进入详情页查看配置；可在详情页中编辑、发布或停用。</p>

    <div class="toolbar">
      <select v-model="statusFilter">
        <option value="all">全部状态</option>
        <option value="enabled">启用</option>
        <option value="disabled">停用</option>
      </select>
      <select v-model="typeFilter">
        <option value="all">全部类型</option>
        <option value="shift">排班制</option>
        <option value="free">自由打卡</option>
        <option value="none">无需打卡</option>
      </select>
      <button type="button" class="primary-btn" @click="openCreate">+ 新建</button>
    </div>

    <div class="list">
      <article v-for="g in groups" :key="g.id" class="card" @click="openDetail(g.id)">
        <div class="card-top">
          <div>
            <strong>{{ g.name }}</strong>
            <span class="code">{{ g.code }}</span>
          </div>
          <span class="status" :class="g.status">{{ g.statusLabel }}</span>
        </div>
        <p class="meta">{{ g.typeLabel }} · {{ g.shiftPeriod }}</p>
        <p class="meta">月最低 {{ g.minMonthlyLabel }} · {{ g.versionLabel }}</p>
        <div class="tags">
          <span v-for="d in g.deptTags" :key="d" class="tag">{{ d }}</span>
          <span v-if="g.deptExtra > 0" class="tag muted">+{{ g.deptExtra }}</span>
        </div>
        <div class="card-actions">
          <button type="button" @click.stop="toggleStatus(g)">
            {{ g.status === 'enabled' ? '停用' : '启用' }}
          </button>
          <button type="button" class="danger" @click.stop="removeGroup(g)">删除</button>
        </div>
      </article>
      <div v-if="!groups.length" class="empty">暂无考勤组，点击「新建」开始配置</div>
    </div>
  </div>
</template>

<style scoped>
.page-desc {
  margin: 0;
  padding: 8px 16px 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 16px;
}
.toolbar select {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  background: #fff;
}
.primary-btn {
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: #228BFF;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.list {
  padding: 0 16px 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card {
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: var(--mini-shadow);
  cursor: pointer;
}
.card-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}
.code {
  display: block;
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}
.status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  flex-shrink: 0;
}
.status.enabled {
  color: #059669;
  background: #ecfdf5;
}
.status.disabled {
  color: #6b7280;
  background: #f3f4f6;
}
.meta {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background: #228BFF;
  color: #fff;
}
.tag.muted {
  background: #f3f4f6;
  color: #6b7280;
}
.card-actions {
  display: flex;
  gap: 12px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}
.card-actions button {
  border: none;
  background: none;
  font-size: 12px;
  color: #228BFF;
  padding: 0;
  cursor: pointer;
}
.card-actions .danger {
  color: #dc2626;
}
.empty {
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
  padding: 32px 12px;
}
</style>
