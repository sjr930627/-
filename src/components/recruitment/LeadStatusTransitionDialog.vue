<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  FEEDBACK_TRANSITION_CARD_META,
  getAvailableTransitions,
  getFeedbackPendingHint,
  getFeedbackTransitionDesc,
  getTransitionLabel,
  recruitmentLeadStatusMap,
} from '@/constants/recruitment'
import type { RecruitmentLead, RecruitmentLeadStatus } from '@/types'

const props = defineProps<{
  modelValue: boolean
  lead: RecruitmentLead | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const store = useAppStore()

const source = ref('')
const targetStatus = ref<RecruitmentLeadStatus | null>(null)
const interviewScore = ref<number | null>(null)
const interviewEvaluation = ref('')
const interviewDate = ref('')
const interviewTime = ref('')
const closeReason = ref('')

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const totalRounds = computed(() => {
  if (!props.lead) return 1
  const req = store.jobRequirements.find((r) => r.id === props.lead!.requirementId)
  return props.lead.totalRounds ?? req?.interviewRounds ?? 1
})

const currentRound = computed(() => props.lead?.currentRound ?? 1)

const availableTargets = computed(() => {
  if (!props.lead) return [] as RecruitmentLeadStatus[]
  return getAvailableTransitions(props.lead.status, {
    ...props.lead,
    totalRounds: totalRounds.value,
    currentRound: currentRound.value,
  })
})

const isFeedbackPending = computed(() => props.lead?.status === 'feedback_pending')

const dialogTitle = computed(() =>
  props.lead ? `编辑线索状态 — ${props.lead.candidateName}` : '编辑线索状态',
)

const statusBanner = computed(() => {
  if (!props.lead) return ''
  return [
    recruitmentLeadStatusMap[props.lead.status],
    props.lead.candidateName,
    props.lead.position,
    props.lead.enterpriseName,
  ].join(' · ')
})

const transitionHint = computed(() => {
  if (!props.lead) return ''
  return `${recruitmentLeadStatusMap[props.lead.status]} → 请选择目标状态`
})

const feedbackHint = computed(() => {
  if (!isFeedbackPending.value) return ''
  return getFeedbackPendingHint({
    currentRound: currentRound.value,
    totalRounds: totalRounds.value,
  })
})

function cardMeta(status: RecruitmentLeadStatus) {
  if (isFeedbackPending.value && FEEDBACK_TRANSITION_CARD_META[status]) {
    return {
      title: FEEDBACK_TRANSITION_CARD_META[status]!.title,
      desc: getFeedbackTransitionDesc(status, {
        currentRound: currentRound.value,
        totalRounds: totalRounds.value,
      }),
    }
  }
  return {
    title: getTransitionLabel(props.lead!.status, status),
    desc: recruitmentLeadStatusMap[status],
  }
}

function resetForm() {
  if (!props.lead) return
  source.value = props.lead.source
  targetStatus.value = availableTargets.value[0] ?? null
  interviewScore.value = props.lead.ext?.interviewScore ?? null
  interviewEvaluation.value = props.lead.interviewFeedback ?? ''
  interviewDate.value = props.lead.interviewDate ?? '2026-07-28'
  interviewTime.value = props.lead.interviewTime ?? '14:00'
  closeReason.value = ''
}

watch(
  () => [props.modelValue, props.lead?.id] as const,
  ([open]) => {
    if (open) resetForm()
  },
)

function selectTarget(status: RecruitmentLeadStatus) {
  targetStatus.value = status
}

function submit() {
  if (!props.lead || !targetStatus.value) {
    ElMessage.warning('请选择目标状态')
    return
  }

  if (isFeedbackPending.value) {
    if (interviewScore.value == null || interviewScore.value < 0 || interviewScore.value > 100) {
      ElMessage.warning('请填写面试评分（0-100）')
      return
    }
    if (!interviewEvaluation.value.trim()) {
      ElMessage.warning('请填写面试评价')
      return
    }
  }

  if (targetStatus.value === 'interview_pending') {
    if (!interviewDate.value.trim()) {
      ElMessage.warning('请填写面试日期')
      return
    }
  }

  if (targetStatus.value === 'closed' && !closeReason.value.trim()) {
    ElMessage.warning('请填写结束原因')
    return
  }

  try {
    if (source.value.trim() && source.value !== props.lead.source) {
      store.updateRecruitmentLead(props.lead.id, { source: source.value.trim() })
    }

    if (targetStatus.value === 'interview_pending') {
      store.updateRecruitmentLead(props.lead.id, {
        interviewDate: interviewDate.value.trim(),
        interviewTime: interviewTime.value.trim() || undefined,
      })
    }

    store.transitionLeadStatus(props.lead.id, targetStatus.value, {
      feedback: isFeedbackPending.value
        ? interviewEvaluation.value.trim()
        : closeReason.value.trim() || undefined,
      deviateReason: closeReason.value.trim() || undefined,
      interviewScore: isFeedbackPending.value ? interviewScore.value ?? undefined : undefined,
    })

    ElMessage.success('状态已更新')
    visible.value = false
    emit('success')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="dialogTitle" width="640px" destroy-on-close class="lead-transition-dialog">
    <template v-if="lead">
      <div class="section-block">
        <div class="section-header">
          <span class="section-dot" />
          <span class="section-title">基础信息</span>
        </div>
        <el-form label-width="72px">
          <el-form-item label="来源">
            <el-select v-model="source" style="width: 100%">
              <el-option label="手动录入" value="手动录入" />
              <el-option label="Boss直聘" value="Boss直聘" />
              <el-option label="内推" value="内推" />
              <el-option label="58同城" value="58同城" />
              <el-option label="猎聘" value="猎聘" />
              <el-option label="内部推荐" value="内部推荐" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <div class="status-banner">{{ statusBanner }}</div>

      <div v-if="isFeedbackPending" class="section-block">
        <div class="section-header">
          <span class="section-dot" />
          <span class="section-title">面试反馈</span>
        </div>
        <el-form label-width="88px">
          <el-form-item label="面试评分" required>
            <div class="score-row">
              <el-input-number
                v-model="interviewScore"
                :min="0"
                :max="100"
                :step="1"
                controls-position="right"
                placeholder="0-100"
              />
              <span class="score-hint">满分 100 分</span>
            </div>
          </el-form-item>
          <el-form-item label="面试评价" required>
            <el-input
              v-model="interviewEvaluation"
              type="textarea"
              :rows="3"
              placeholder="请填写本轮面试表现、优劣势及录用建议..."
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </div>

      <div class="transition-block">
        <div class="transition-subtitle">{{ transitionHint }}</div>
        <div v-if="feedbackHint" class="transition-tip">{{ feedbackHint }}</div>

        <div class="status-card-grid">
          <button
            v-for="status in availableTargets"
            :key="status"
            type="button"
            class="status-card"
            :class="{ active: targetStatus === status }"
            @click="selectTarget(status)"
          >
            <span class="status-card-title">{{ cardMeta(status).title }}</span>
            <span class="status-card-desc">{{ cardMeta(status).desc }}</span>
          </button>
        </div>
      </div>

      <div v-if="targetStatus === 'interview_pending'" class="section-block">
        <div class="section-header">
          <span class="section-dot" />
          <span class="section-title">下一轮面试配置</span>
        </div>
        <el-form label-width="88px">
          <el-form-item label="面试日期" required>
            <el-date-picker
              v-model="interviewDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="面试时间">
            <el-time-select
              v-model="interviewTime"
              start="08:00"
              step="00:30"
              end="20:00"
              placeholder="选择时间"
              style="width: 100%"
            />
          </el-form-item>
        </el-form>
      </div>

      <div v-if="targetStatus === 'closed' && !isFeedbackPending" class="section-block">
        <div class="section-header">
          <span class="section-dot" />
          <span class="section-title">结束跟进</span>
        </div>
        <el-input
          v-model="closeReason"
          type="textarea"
          :rows="3"
          placeholder="请填写结束原因..."
        />
      </div>
    </template>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="submit">确认变更</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.section-block {
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.section-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
  flex-shrink: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.status-banner {
  padding: 10px 14px;
  margin-bottom: 16px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.transition-block {
  margin-bottom: 16px;
}

.transition-subtitle {
  font-size: 13px;
  color: #409eff;
  margin-bottom: 8px;
}

.transition-tip {
  padding: 8px 12px;
  margin-bottom: 12px;
  background: #fdf6ec;
  border-radius: 6px;
  font-size: 12px;
  color: #e6a23c;
  line-height: 1.5;
}

.status-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.status-card {
  text-align: left;
  padding: 14px 16px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.status-card:hover {
  border-color: #409eff;
}

.status-card.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.status-card-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.status-card.active .status-card-title {
  color: #409eff;
}

.status-card-desc {
  display: block;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.score-hint {
  font-size: 12px;
  color: #909399;
}
</style>
