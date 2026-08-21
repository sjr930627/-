<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import WorkflowFlowChart from '@/components/task/WorkflowFlowChart.vue'
import {
  formatTaskQuantity,
  formatTaskTypePrice,
  workflowStatusMap,
} from '@/constants/task'
import { buildTaskTypeLifecycleRecords } from '@/services/taskTypeLifecycle'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const includeOpLogs = ref(true)

const taskType = computed(() =>
  store.taskTypes.find((t) => t.id === route.params.id as string),
)

const workflow = computed(() =>
  taskType.value
    ? store.taskWorkflows.find((w) => w.id === taskType.value!.workflowId)
    : undefined,
)

const lifecycleRecords = computed(() =>
  taskType.value ? buildTaskTypeLifecycleRecords(taskType.value) : [],
)

const statusMeta = computed(() => {
  if (!taskType.value) return { label: '-', type: 'info' as const, dot: '#909399' }
  const map: Record<string, { label: string; type: 'success' | 'warning' | 'danger' | 'info'; dot: string }> = {
    draft: { label: '草稿', type: 'info', dot: '#909399' },
    pending: { label: '审批中', type: 'warning', dot: '#e6a23c' },
    published: { label: '已发布', type: 'success', dot: '#67c23a' },
    rejected: { label: '已驳回', type: 'danger', dot: '#f56c6c' },
    disabled: { label: '已停用', type: 'info', dot: '#909399' },
  }
  return map[taskType.value.status] ?? map.draft
})

const quantityLabel = computed(() =>
  taskType.value
    ? formatTaskQuantity(taskType.value.unlimitedQuantity, taskType.value.defaultQuantity)
    : '-',
)

const validityLabel = computed(() => {
  if (!taskType.value) return '-'
  return taskType.value.longTerm
    ? '长期有效'
    : `${taskType.value.validFrom ?? '-'} ~ ${taskType.value.validTo ?? '-'}`
})

const relatedTaskCount = computed(() =>
  taskType.value
    ? store.tasks.filter((t) => t.taskTypeId === taskType.value!.id).length
    : 0,
)

function formatTime(iso?: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN')
}

async function review(approved: boolean) {
  if (!taskType.value) return
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
    store.reviewTaskType(taskType.value.id, approved, value)
    ElMessage.success(approved ? '审批通过，任务类型已生效' : '已驳回')
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div v-if="taskType" class="task-type-detail-page">
    <div class="page-breadcrumb-row">
      <el-breadcrumb separator=">">
        <el-breadcrumb-item>任务管理</el-breadcrumb-item>
        <el-breadcrumb-item @click="router.push('/task-approval')">任务审批</el-breadcrumb-item>
        <el-breadcrumb-item>类型详情</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="header-actions">
        <el-button @click="router.push('/task-approval')">返回列表</el-button>
      </div>
    </div>

    <div class="detail-layout">
      <div class="detail-main">
        <section class="page-card section-card">
          <div class="section-head">
            <div class="section-icon section-icon--blue">基</div>
            <div class="section-head-text">
              <h3>任务类型基本信息</h3>
              <p>企业提交的任务类型配置与定价规则</p>
            </div>
            <el-tag :type="statusMeta.type" size="small" class="status-badge">
              {{ statusMeta.label }}
            </el-tag>
          </div>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="类型 ID">{{ taskType.id }}</el-descriptions-item>
            <el-descriptions-item label="审批状态">
              <span class="status-dot" :style="{ background: statusMeta.dot }" />
              {{ statusMeta.label }}
            </el-descriptions-item>
            <el-descriptions-item label="企业名称">{{ taskType.enterpriseName }}</el-descriptions-item>
            <el-descriptions-item label="任务类型">{{ taskType.name }}</el-descriptions-item>
            <el-descriptions-item label="关联工作流">
              {{ workflow?.name ?? '-' }}
              <el-tag v-if="workflow" size="small" type="info" style="margin-left: 6px">
                {{ workflowStatusMap[workflow.status] }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="任务数量">{{ quantityLabel }}</el-descriptions-item>
            <el-descriptions-item label="单价模式">
              {{ taskType.pricingMode === 'fixed' ? '固定单价' : '阶梯单价' }}
            </el-descriptions-item>
            <el-descriptions-item label="任务单价">
              {{ formatTaskTypePrice(taskType) }}
            </el-descriptions-item>
            <el-descriptions-item v-if="taskType.incentive" label="激励规则" :span="2">
              {{ taskType.incentive }}
            </el-descriptions-item>
            <el-descriptions-item label="有效期">{{ validityLabel }}</el-descriptions-item>
            <el-descriptions-item label="关联任务数">{{ relatedTaskCount }} 个</el-descriptions-item>
            <el-descriptions-item v-if="taskType.trainingCourseId" label="培训要求" :span="2">
              须完成培训课程 {{ taskType.trainingCourseId }}
            </el-descriptions-item>
            <el-descriptions-item label="任务描述" :span="2">
              <div class="desc-block">{{ taskType.description }}</div>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(taskType.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="最后更新">
              {{ formatTime(taskType.reviewedAt ?? taskType.submittedAt ?? taskType.createdAt) }}
            </el-descriptions-item>
          </el-descriptions>
        </section>

        <section class="page-card section-card">
          <div class="section-head">
            <div class="section-icon section-icon--green">流</div>
            <div class="section-head-text">
              <h3>生命周期流转记录</h3>
              <p>任务类型从创建到审批的全流程轨迹</p>
            </div>
            <div class="timeline-toolbar">
              <span class="record-count">{{ lifecycleRecords.length }} 条记录</span>
              <el-switch v-model="includeOpLogs" active-text="含操作日志" />
            </div>
          </div>

          <el-timeline class="lifecycle-timeline">
            <el-timeline-item
              v-for="record in lifecycleRecords"
              :key="record.id"
              :type="record.type === 'current' ? 'primary' : record.type === 'manual' ? 'warning' : 'success'"
              :hollow="record.type !== 'current'"
              placement="top"
            >
              <div class="timeline-card" :class="{ current: record.type === 'current', manual: record.type === 'manual' }">
                <div class="timeline-head">
                  <strong>{{ record.title }}</strong>
                  <el-tag v-if="record.tag" size="small" :type="record.type === 'manual' ? 'warning' : 'info'">
                    {{ record.tag }}
                  </el-tag>
                </div>
                <div v-if="record.operator || record.time" class="timeline-meta">
                  <span v-if="record.operator">操作人：{{ record.operator }}</span>
                  <span v-if="record.time">{{ formatTime(record.time) }}</span>
                </div>
                <p v-if="record.description" class="timeline-desc">{{ record.description }}</p>
              </div>
            </el-timeline-item>
          </el-timeline>
        </section>
      </div>

      <div class="detail-side">
        <section class="page-card side-card">
          <div class="side-card-head">
            <h3>工作流进度</h3>
            <p>关联工作流的节点与流转路径</p>
          </div>
          <WorkflowFlowChart v-if="workflow" :workflow="workflow" compact />
          <div class="flow-legend">
            <span><i class="dot done" /> 已完成</span>
            <span><i class="dot current" /> 当前</span>
            <span><i class="dot pending" /> 待处理</span>
          </div>
        </section>

        <section class="page-card side-card">
          <div class="side-card-head">
            <h3>审批操作</h3>
            <p>对待审批任务类型进行审核</p>
          </div>

          <template v-if="taskType.status === 'pending'">
            <div class="action-block">
              <div class="action-label">审批决策</div>
              <div class="action-row">
                <el-button type="success" style="flex: 1" @click="review(true)">通过</el-button>
                <el-button type="danger" style="flex: 1" @click="review(false)">驳回</el-button>
              </div>
            </div>
          </template>
          <template v-else>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="申请人">{{ taskType.applicant ?? '-' }}</el-descriptions-item>
              <el-descriptions-item label="提交时间">{{ formatTime(taskType.submittedAt) }}</el-descriptions-item>
              <el-descriptions-item v-if="taskType.reviewedBy" label="审批人">
                {{ taskType.reviewedBy }}
              </el-descriptions-item>
              <el-descriptions-item v-if="taskType.reviewedAt" label="审批时间">
                {{ formatTime(taskType.reviewedAt) }}
              </el-descriptions-item>
              <el-descriptions-item v-if="taskType.reviewNote" label="审批意见">
                {{ taskType.reviewNote }}
              </el-descriptions-item>
            </el-descriptions>
          </template>

          <el-alert
            type="warning"
            :closable="false"
            show-icon
            class="action-hint"
            title="所有审批操作均会记录日志并通知企业端。"
          />
        </section>
      </div>
    </div>
  </div>

  <el-empty v-else description="任务类型不存在" class="page-card">
    <el-button type="primary" @click="router.push('/task-approval')">返回</el-button>
  </el-empty>
</template>

<style scoped>
.task-type-detail-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-breadcrumb-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 16px;
  align-items: start;
}

.detail-main,
.detail-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card {
  padding: 20px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.section-head-text {
  flex: 1;
}

.section-head-text h3,
.side-card-head h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.section-head-text p,
.side-card-head p {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.section-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.section-icon--blue {
  background: linear-gradient(135deg, #409eff, #096dd9);
}

.section-icon--green {
  background: linear-gradient(135deg, #67c23a, #389e0d);
}

.status-badge {
  margin-left: auto;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.desc-block {
  white-space: pre-wrap;
  line-height: 1.6;
  color: #606266;
}

.timeline-toolbar {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #909399;
}

.lifecycle-timeline {
  padding-top: 4px;
}

.timeline-card {
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px 14px;
}

.timeline-card.current {
  background: #ecf5ff;
  border-color: #b3d8ff;
}

.timeline-card.manual {
  background: #fdf6ec;
  border-color: #f5dab1;
}

.timeline-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.timeline-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.timeline-desc {
  margin: 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.side-card {
  padding: 18px;
}

.side-card-head {
  margin-bottom: 14px;
}

.flow-legend {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  font-size: 12px;
  color: #909399;
}

.flow-legend .dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.flow-legend .dot.done {
  background: #67c23a;
}

.flow-legend .dot.current {
  background: #409eff;
}

.flow-legend .dot.pending {
  background: #dcdfe6;
}

.action-block {
  margin-bottom: 12px;
}

.action-label {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.action-row {
  display: flex;
  gap: 8px;
}

.action-hint {
  margin-top: 14px;
}

@media (max-width: 1100px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
}
</style>
