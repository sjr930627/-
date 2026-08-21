<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  formatReminderConditions,
  reminderRoleMap,
  reminderSceneMap,
  reminderSceneOptions,
  reminderStatusMap,
} from '@/constants/reminderRule'
import type { ReminderRule, ReminderRuleStatus, ReminderSceneCategory } from '@/types'

const store = useAppStore()
const router = useRouter()

const keyword = ref('')
const statusFilter = ref<'all' | ReminderRuleStatus>('all')
const sceneFilter = ref<'all' | ReminderSceneCategory>('all')
const page = ref(1)
const pageSize = ref(10)
const selectedIds = ref<string[]>([])

const tableData = computed(() =>
  store.reminderRules
    .map((rule) => ({
      ...rule,
      sceneLabel: reminderSceneMap[rule.scene],
      conditionLabel: formatReminderConditions(rule.conditions),
      receiverLabel: rule.receiverRole
        ? reminderRoleMap[rule.receiverRole] ?? rule.receiverRole
        : reminderRoleMap[rule.receiverMode] ?? rule.receiverMode,
      statusMeta: reminderStatusMap[rule.status],
    }))
    .filter((row) => {
      if (statusFilter.value !== 'all' && row.status !== statusFilter.value) return false
      if (sceneFilter.value !== 'all' && row.scene !== sceneFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        row.name.toLowerCase().includes(kw) ||
        row.sceneLabel.toLowerCase().includes(kw) ||
        row.conditionLabel.toLowerCase().includes(kw) ||
        (row.description ?? '').toLowerCase().includes(kw)
      )
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
)

const pagedData = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return tableData.value.slice(start, start + pageSize.value)
})

function handleSelection(rows: ReminderRule[]) {
  selectedIds.value = rows.map((r) => r.id)
}

function goCreate() {
  router.push('/system/reminder-rules/create')
}

function goEdit(id: string) {
  router.push(`/system/reminder-rules/${id}/edit`)
}

function batchSetStatus(status: ReminderRuleStatus) {
  if (!selectedIds.value.length) {
    ElMessage.warning('请先选择规则')
    return
  }
  const count = store.batchSetReminderRuleStatus(selectedIds.value, status)
  ElMessage.success(`已${status === 'active' ? '启用' : '停用'} ${count} 条规则`)
  selectedIds.value = []
}

async function toggleStatus(row: ReminderRule) {
  const next = row.status === 'active' ? 'disabled' : 'active'
  store.setReminderRuleStatus(row.id, next)
  ElMessage.success(next === 'active' ? '已启用' : '已停用')
}

async function removeRule(row: ReminderRule) {
  try {
    await ElMessageBox.confirm(`确定删除提醒规则「${row.name}」？`, '删除确认', {
      type: 'warning',
    })
    store.removeReminderRule(row.id)
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">提醒规则配置</h2>
        <p class="text-muted">统一配置全局 / 后台 / 企业侧提醒规则，支持启用停用与条件编排</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="goCreate">
          <el-icon><Plus /></el-icon>
          新建提醒规则
        </el-button>
        <el-button :disabled="!selectedIds.length" @click="batchSetStatus('active')">批量启用</el-button>
        <el-button :disabled="!selectedIds.length" @click="batchSetStatus('disabled')">
          批量停用
        </el-button>
      </div>
    </div>

    <div class="page-toolbar">
      <el-select v-model="statusFilter" style="width: 140px" @change="page = 1">
        <el-option label="全部状态" value="all" />
        <el-option label="生效" value="active" />
        <el-option label="停用" value="disabled" />
      </el-select>
      <el-select v-model="sceneFilter" style="width: 160px" @change="page = 1">
        <el-option label="全部场景" value="all" />
        <el-option
          v-for="opt in reminderSceneOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索规则名称、条件..."
        prefix-icon="Search"
        style="width: 280px"
        @change="page = 1"
      />
    </div>

    <el-table :data="pagedData" border stripe @selection-change="handleSelection">
      <el-table-column type="selection" width="48" />
      <el-table-column prop="name" label="规则名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="sceneLabel" label="提醒场景" width="110" />
      <el-table-column prop="conditionLabel" label="触发条件" min-width="240" show-overflow-tooltip />
      <el-table-column prop="receiverLabel" label="接收人" width="110" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <span class="status-dot" :class="row.status" />
          {{ row.statusMeta.label }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="goEdit(row.id)">编辑</el-button>
          <el-button link type="primary" @click="toggleStatus(row)">
            {{ row.status === 'active' ? '停用' : '启用' }}
          </el-button>
          <el-button link type="danger" @click="removeRule(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-footer">
      <span class="text-muted">共 {{ tableData.length }} 条</span>
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="tableData.length"
        layout="prev, pager, next"
        background
      />
    </div>
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

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.page-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.status-dot.active {
  background: #67c23a;
}

.status-dot.disabled {
  background: #c0c4cc;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
}
</style>
