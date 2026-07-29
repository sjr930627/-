<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  attendanceGroupStatusMap,
  attendanceGroupTypeMap,
  formatDeptBindings,
  formatMinMonthlyHours,
  formatShiftPeriod,
} from '@/constants/attendanceGroup'

const store = useAppStore()
const router = useRouter()

const statusFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const typeFilter = ref<'all' | 'shift' | 'free' | 'none'>('all')
const deptFilter = ref('')
const page = ref(1)
const pageSize = 5

const tableData = computed(() =>
  store.attendanceGroups
    .filter((g) => {
      if (statusFilter.value !== 'all' && g.status !== statusFilter.value) return false
      if (typeFilter.value !== 'all' && g.attendanceType !== typeFilter.value) return false
      if (deptFilter.value && !g.departmentBindings.some((b) => b.departmentId === deptFilter.value)) {
        return false
      }
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
        areaLabel: g.attendanceArea ?? (g.punchLocations[0]?.name ?? '不限区域'),
        deptTags: depts.visible,
        deptExtra: depts.extra,
      }
    }),
)

const pagedData = computed(() => {
  const start = (page.value - 1) * pageSize
  return tableData.value.slice(start, start + pageSize)
})

const total = computed(() => tableData.value.length)

function openCreate() {
  router.push('/attendance-groups/create')
}

function openEdit(id: string) {
  router.push(`/attendance-groups/${id}/edit`)
}

async function toggleStatus(row: { id: string; status: string; name: string }) {
  store.toggleAttendanceGroupStatus(row.id)
  ElMessage.success(row.status === 'enabled' ? '已停用' : '已启用')
}

async function remove(id: string, name: string) {
  await ElMessageBox.confirm(`确定删除考勤组「${name}」？`, '提示', { type: 'warning' })
  store.removeAttendanceGroup(id)
  ElMessage.success('已删除')
}

function resetFilters() {
  statusFilter.value = 'all'
  typeFilter.value = 'all'
  deptFilter.value = ''
  page.value = 1
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">考勤组管理</h2>
        <p class="text-muted">V2.0 · 支持多班次排班，每个考勤组可配置独立考勤规则</p>
      </div>
      <el-button type="primary" @click="openCreate">+ 新建考勤组</el-button>
    </div>

    <div class="page-toolbar">
      <el-select v-model="statusFilter" placeholder="全部状态" style="width: 130px">
        <el-option label="全部状态" value="all" />
        <el-option label="启用" value="enabled" />
        <el-option label="停用" value="disabled" />
      </el-select>
      <el-select v-model="deptFilter" placeholder="全部部门" clearable style="width: 160px">
        <el-option
          v-for="d in store.departments"
          :key="d.id"
          :label="d.name"
          :value="d.id"
        />
      </el-select>
      <el-select v-model="typeFilter" placeholder="考勤类型" style="width: 130px">
        <el-option label="全部类型" value="all" />
        <el-option label="排班制" value="shift" />
        <el-option label="自由打卡" value="free" />
        <el-option label="不计考勤" value="none" />
      </el-select>
      <el-button @click="resetFilters">
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>

    <el-table :data="pagedData" border stripe>
      <el-table-column label="考勤组名称" min-width="180">
        <template #default="{ row }">
          <div class="group-name-cell">
            <div class="group-icon">
              <el-icon><Clock /></el-icon>
            </div>
            <div>
              <div class="group-name">{{ row.name }}</div>
              <div class="group-code">{{ row.code }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="关联部门" min-width="160">
        <template #default="{ row }">
          <el-tag v-for="d in row.deptTags" :key="d" size="small" class="dept-tag">{{ d }}</el-tag>
          <el-tag v-if="row.deptExtra > 0" size="small" type="info">+{{ row.deptExtra }}</el-tag>
          <span v-if="!row.deptTags.length" class="text-muted">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="typeLabel" label="考勤类型" width="100" />
      <el-table-column prop="shiftPeriod" label="考勤时段" min-width="150" />
      <el-table-column prop="minMonthlyLabel" label="月最低在线" width="110" align="center" />
      <el-table-column label="考勤区域" min-width="120">
        <template #default="{ row }">
          <el-icon v-if="row.areaLabel !== '不限区域'" class="area-icon"><Location /></el-icon>
          {{ row.areaLabel }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <span class="status-dot" :class="row.status" />
          {{ row.statusLabel }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row.id)">编辑</el-button>
          <el-button link @click="toggleStatus(row)">
            {{ row.status === 'enabled' ? '停用' : '启用' }}
          </el-button>
          <el-dropdown trigger="click">
            <el-button link><el-icon><MoreFilled /></el-icon></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="openEdit(row.id)">复制配置</el-dropdown-item>
                <el-dropdown-item divided @click="remove(row.id, row.name)">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-footer">
      <span class="text-muted">
        显示 {{ total === 0 ? 0 : (page - 1) * pageSize + 1 }} 到
        {{ Math.min(page * pageSize, total) }} 条，共 {{ total }} 条记录
      </span>
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        background
        small
      />
    </div>
  </div>
</template>

<style scoped>
.group-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--app-primary-light);
  color: var(--app-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.group-name {
  font-weight: 600;
  font-size: 14px;
}

.group-code {
  font-size: 12px;
  color: #909399;
}

.dept-tag {
  margin-right: 4px;
}

.area-icon {
  vertical-align: middle;
  margin-right: 2px;
  color: var(--app-primary);
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.status-dot.enabled {
  background: #67c23a;
}

.status-dot.disabled {
  background: #f56c6c;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}
</style>
