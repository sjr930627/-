<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  formatTaskTypePrice,
  taskTypeStatusMap,
  workflowStatusMap,
} from '@/constants/task'
import type { TaskType } from '@/types'

const store = useAppStore()
const activeTab = ref<'pending' | 'all'>('pending')
const detailVisible = ref(false)
const currentRow = ref<TaskType | null>(null)

const tableData = computed(() =>
  store.taskTypes
    .filter((t) => (activeTab.value === 'pending' ? t.status === 'pending' : true))
    .map((t) => {
      const wf = store.taskWorkflows.find((w) => w.id === t.workflowId)
      return {
        ...t,
        workflowName: wf?.name ?? '-',
        workflowStatus: wf ? workflowStatusMap[wf.status] : '-',
        priceLabel: formatTaskTypePrice(t),
        statusLabel: taskTypeStatusMap[t.status],
        validityLabel: t.longTerm
          ? '长期有效'
          : `${t.validFrom ?? '-'} ~ ${t.validTo ?? '-'}`,
      }
    }),
)

const pendingCount = computed(() => store.taskTypes.filter((t) => t.status === 'pending').length)

function showDetail(row: TaskType) {
  currentRow.value = row
  detailVisible.value = true
}

async function review(id: string, approved: boolean) {
  try {
    const { value } = await ElMessageBox.prompt(
      approved ? '审批意见（可选）' : '驳回原因（必填）',
      approved ? '通过任务类型' : '驳回任务类型',
      {
        inputValue: approved ? '符合规范，予以通过' : '',
        inputPlaceholder: '请输入',
        inputValidator: (v) => {
          if (!approved && !v?.trim()) return '请填写驳回原因'
          return true
        },
      },
    )
    store.reviewTaskType(id, approved, value)
    ElMessage.success(approved ? '审批通过，任务类型已生效' : '已驳回')
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">任务类型审批</h2>
        <p class="text-muted">
          审核企业提交的任务类型申请，通过后自动同步至企业端与灵工端任务大厅 · 待审批 {{ pendingCount }} 条
        </p>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane :label="`待审批 (${pendingCount})`" name="pending" />
      <el-tab-pane label="全部记录" name="all" />
    </el-tabs>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="enterpriseName" label="企业名称" min-width="160" />
      <el-table-column prop="name" label="任务类型" min-width="140" />
      <el-table-column prop="workflowName" label="关联工作流" min-width="160" />
      <el-table-column prop="priceLabel" label="单价" min-width="160" show-overflow-tooltip />
      <el-table-column prop="applicant" label="申请人" width="100" />
      <el-table-column label="提交时间" width="170">
        <template #default="{ row }">
          {{ row.submittedAt ? new Date(row.submittedAt).toLocaleString('zh-CN') : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="
              row.status === 'published'
                ? 'success'
                : row.status === 'pending'
                  ? 'warning'
                  : row.status === 'rejected'
                    ? 'danger'
                    : 'info'
            "
          >
            {{ row.statusLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDetail(row)">详情</el-button>
          <template v-if="row.status === 'pending'">
            <el-button link type="success" @click="review(row.id, true)">通过</el-button>
            <el-button link type="danger" @click="review(row.id, false)">驳回</el-button>
          </template>
          <span v-else-if="row.reviewNote" class="text-muted">{{ row.reviewNote }}</span>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-drawer v-model="detailVisible" title="任务类型详情" size="480px">
    <template v-if="currentRow">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="企业">{{ currentRow.enterpriseName }}</el-descriptions-item>
        <el-descriptions-item label="任务类型">{{ currentRow.name }}</el-descriptions-item>
        <el-descriptions-item label="关联工作流">
          {{ store.taskWorkflows.find((w) => w.id === currentRow!.workflowId)?.name ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="单价模式">
          {{ currentRow.pricingMode === 'fixed' ? '固定单价' : '阶梯单价' }}
        </el-descriptions-item>
        <el-descriptions-item label="单价">
          {{ formatTaskTypePrice(currentRow) }}
        </el-descriptions-item>
        <el-descriptions-item v-if="currentRow.incentive" label="激励规则">
          {{ currentRow.incentive }}
        </el-descriptions-item>
        <el-descriptions-item label="有效期">
          {{
            currentRow.longTerm
              ? '长期有效'
              : `${currentRow.validFrom} ~ ${currentRow.validTo}`
          }}
        </el-descriptions-item>
        <el-descriptions-item v-if="currentRow.trainingCourseId" label="培训要求">
          须完成培训课程 {{ currentRow.trainingCourseId }}
        </el-descriptions-item>
        <el-descriptions-item label="任务描述">
          <div class="desc-block">{{ currentRow.description }}</div>
        </el-descriptions-item>
        <el-descriptions-item v-if="currentRow.reviewNote" label="审批意见">
          {{ currentRow.reviewNote }}
        </el-descriptions-item>
      </el-descriptions>
    </template>
  </el-drawer>
</template>

<style scoped>
.desc-block {
  white-space: pre-wrap;
  line-height: 1.6;
  color: #606266;
}
</style>
