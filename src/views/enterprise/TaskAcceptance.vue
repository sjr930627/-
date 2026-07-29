<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { getEnterpriseReviewNode } from '@/services/task'

const store = useAppStore()

const enterpriseName = computed(() => store.currentEnterprise?.name ?? '')

const pendingList = computed(() =>
  store.taskInstances
    .filter((i) => {
      if (i.enterpriseName !== enterpriseName.value) return false
      const task = store.tasks.find((t) => t.id === i.taskId)
      if (!task) return false
      const wf = store.taskWorkflows.find((w) => w.id === task.workflowId)
      if (!wf) return false
      const reviewNode = getEnterpriseReviewNode(wf)
      return reviewNode && i.currentNodeId === reviewNode.id
    })
    .map((i) => ({
      ...i,
      submittedAt: new Date(i.updatedAt).toLocaleString('zh-CN'),
    })),
)

const historyList = computed(() =>
  store.taskInstances
    .filter((i) => i.enterpriseName === enterpriseName.value)
    .filter((i) => {
      const task = store.tasks.find((t) => t.id === i.taskId)
      const wf = task ? store.taskWorkflows.find((w) => w.id === task.workflowId) : null
      if (!wf) return false
      const reviewNode = getEnterpriseReviewNode(wf)
      const endNode = wf.nodes.find((n) => n.nodeType === 'end')
      if (!reviewNode) return false
      return (
        i.currentNodeId === endNode?.id ||
        (i.currentNodeName.includes('执行') && i.updatedAt > i.createdAt)
      )
    })
    .slice(0, 20)
    .map((i) => ({
      ...i,
      result:
        i.currentNodeName.includes('已完成') || i.currentNodeName.includes('已结算')
          ? '已通过'
          : '已驳回',
      time: new Date(i.updatedAt).toLocaleString('zh-CN'),
    })),
)

async function review(id: string, approved: boolean) {
  try {
    const { value } = await ElMessageBox.prompt(
      approved ? '验收意见（可选）' : '驳回原因（必填）',
      approved ? '确认完成' : '驳回任务',
      {
        inputValue: approved ? '验收合格' : '',
        inputPlaceholder: '请输入',
        inputValidator: (v) => {
          if (!approved && !v?.trim()) return '请填写驳回原因'
          return true
        },
      },
    )
    store.reviewTaskInstance(id, approved, value)
    ElMessage.success(approved ? '验收通过，已进入结算流程' : '已驳回，灵工需重新执行')
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">任务验收</h2>
        <p class="text-muted">
          确认灵工提交的任务完成情况 · 待验收 {{ pendingList.length }} 条（不含需运营审核的节点）
        </p>
      </div>
    </div>

    <h4 class="section-title">待验收</h4>
    <el-table :data="pendingList" border stripe empty-text="暂无待验收任务">
      <el-table-column prop="taskName" label="任务" min-width="160" />
      <el-table-column prop="taskTypeName" label="任务类型" width="130" />
      <el-table-column prop="workerName" label="灵工" width="90" />
      <el-table-column label="提交金额" width="100">
        <template #default="{ row }">¥{{ row.amount }}</template>
      </el-table-column>
      <el-table-column prop="currentNodeName" label="当前节点" width="100">
        <template #default="{ row }">
          <el-tag type="warning" size="small">{{ row.currentNodeName }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="submittedAt" label="提交时间" width="170" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="success" @click="review(row.id, true)">确认完成</el-button>
          <el-button link type="danger" @click="review(row.id, false)">驳回</el-button>
        </template>
      </el-table-column>
    </el-table>

    <h4 class="section-title">近期验收记录</h4>
    <el-table :data="historyList" border stripe size="small">
      <el-table-column prop="taskName" label="任务" min-width="140" />
      <el-table-column prop="workerName" label="灵工" width="80" />
      <el-table-column label="金额" width="80">
        <template #default="{ row }">¥{{ row.amount }}</template>
      </el-table-column>
      <el-table-column label="结果" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.result === '已通过' ? 'success' : 'danger'">
            {{ row.result }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="currentNodeName" label="当前状态" width="100" />
      <el-table-column prop="time" label="处理时间" min-width="160" />
    </el-table>
  </div>
</template>

<style scoped>
.section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.section-title:not(:first-of-type) {
  margin-top: 24px;
}
</style>
