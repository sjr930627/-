<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Download, EditPen } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import {
  formatRoundHint,
  isLeadTerminal,
  recruitmentLeadStatusMap,
  recruitmentLeadStatusType,
} from '@/constants/recruitment'
import {
  buildLeadFlowRecords,
  formatDateTime,
  formatGender,
  getEmploymentTypeLabel,
  getRecruitmentProgressSteps,
  getLeadProgressStepIndex,
} from '@/services/recruitmentLeadDetail'
import type { RecruitmentLead } from '@/types'

const props = defineProps<{
  modelValue: boolean
  leadId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  advance: [lead: RecruitmentLead]
}>()

const store = useAppStore()
const editingBasic = ref(false)
const basicForm = ref({ source: '', notes: '' })

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const lead = computed(() =>
  props.leadId ? store.recruitmentLeads.find((l) => l.id === props.leadId) ?? null : null,
)

const requirement = computed(() =>
  lead.value ? store.jobRequirements.find((r) => r.id === lead.value!.requirementId) : null,
)

const talent = computed(() =>
  lead.value?.talentId ? store.talents.find((t) => t.id === lead.value!.talentId) : null,
)

const progressSteps = computed(() => (lead.value ? getRecruitmentProgressSteps(lead.value) : []))

const flowRecords = computed(() => (lead.value ? buildLeadFlowRecords(lead.value) : []))

const resumeName = computed(() =>
  lead.value ? `${lead.value.candidateName}.pdf` : '',
)

watch(
  () => lead.value?.id,
  () => {
    editingBasic.value = false
    if (lead.value) {
      basicForm.value = {
        source: lead.value.source,
        notes: lead.value.notes ?? '',
      }
    }
  },
)

function saveBasic() {
  if (!lead.value) return
  store.updateRecruitmentLead(lead.value.id, {
    source: basicForm.value.source.trim(),
    notes: basicForm.value.notes.trim() || undefined,
    lastFollowUpAt: new Date().toISOString(),
  })
  editingBasic.value = false
  ElMessage.success('已保存')
}

async function addRemark() {
  if (!lead.value) return
  try {
    const { value } = await ElMessageBox.prompt('请输入跟进备注', '添加备注', {
      inputType: 'textarea',
      inputValue: lead.value.notes ?? '',
    })
    store.updateRecruitmentLead(lead.value.id, {
      notes: value.trim(),
      lastFollowUpAt: new Date().toISOString(),
    })
    ElMessage.success('备注已添加')
  } catch {
    // cancelled
  }
}

function handleAdvance() {
  if (!lead.value) return
  emit('advance', lead.value)
}

function previewResume() {
  ElMessage.info('简历预览（演示）')
}

function downloadResume() {
  ElMessage.success(`已开始下载 ${resumeName.value}（演示）`)
}
</script>

<template>
  <el-drawer
    v-model="visible"
    title="招聘详情"
    size="820px"
    destroy-on-close
    class="recruitment-detail-drawer"
  >
    <template v-if="lead">
      <!-- 候选人信息 -->
      <section class="detail-section">
        <div class="section-head">
          <h3>候选人信息</h3>
          <div class="section-actions">
            <el-tag size="small" :type="recruitmentLeadStatusType[lead.status]">
              {{ recruitmentLeadStatusMap[lead.status] }}
            </el-tag>
            <el-button
              v-if="!editingBasic"
              size="small"
              :icon="EditPen"
              @click="editingBasic = true"
            >
              编辑
            </el-button>
            <template v-else>
              <el-button size="small" @click="editingBasic = false">取消</el-button>
              <el-button size="small" type="primary" @click="saveBasic">保存</el-button>
            </template>
          </div>
        </div>

        <div v-if="!editingBasic" class="info-grid">
          <div class="info-item span-2">
            <span class="info-label">姓名 / 联系方式</span>
            <span class="info-value">{{ lead.candidateName }} · {{ lead.phone }}</span>
          </div>
          <div class="info-item span-2">
            <span class="info-label">应聘岗位 / 企业</span>
            <span class="info-value">{{ lead.requirementTitle }} · {{ lead.enterpriseName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">学历 / 经验</span>
            <span class="info-value">
              {{ talent?.education ?? '—' }} · {{ talent?.experience ?? '无经验' }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">年龄 / 性别</span>
            <span class="info-value">
              {{ talent?.age ? `${talent.age} 岁` : '—' }} · {{ formatGender(talent?.gender) }}
            </span>
          </div>
          <div class="info-item span-2">
            <span class="info-label">来源 / 跟进人</span>
            <span class="info-value">
              {{ lead.source }} · {{ lead.assignedTo ?? lead.interviewer ?? '—' }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">用工类型</span>
            <span class="info-value">{{ getEmploymentTypeLabel(requirement?.employmentType) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">技能标签</span>
            <span class="info-value">
              <template v-if="talent?.skills?.length">
                <el-tag v-for="s in talent.skills.slice(0, 3)" :key="s" size="small" class="skill-tag">
                  {{ s }}
                </el-tag>
              </template>
              <span v-else class="text-muted">—</span>
            </span>
          </div>
          <div v-if="lead.interviewDate" class="info-item span-2">
            <span class="info-label">面试安排</span>
            <span class="info-value">
              {{ lead.interviewDate }} {{ lead.interviewTime ?? '' }}
              <span v-if="formatRoundHint(lead)" class="round-hint">{{ formatRoundHint(lead) }}</span>
            </span>
          </div>
          <div v-if="lead.ext?.interviewScore != null" class="info-item">
            <span class="info-label">面试评分</span>
            <span class="info-value score">{{ lead.ext.interviewScore }} 分</span>
          </div>
          <div v-if="lead.interviewFeedback" class="info-item span-2">
            <span class="info-label">面试评价</span>
            <span class="info-value">{{ lead.interviewFeedback }}</span>
          </div>
          <div v-if="lead.ext?.deviated" class="info-item span-2">
            <span class="info-label">流程偏离</span>
            <span class="info-value warn">{{ lead.ext.deviateReason }}</span>
          </div>
        </div>

        <el-form v-else label-width="88px" class="edit-form">
          <el-form-item label="来源">
            <el-input v-model="basicForm.source" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="basicForm.notes" type="textarea" :rows="3" />
          </el-form-item>
        </el-form>
      </section>

      <!-- 候选人简历 -->
      <section class="detail-section">
        <div class="section-head">
          <h3>候选人简历</h3>
        </div>
        <div class="resume-row">
          <div class="resume-file">
            <el-icon><Document /></el-icon>
            <span>{{ resumeName }}</span>
          </div>
          <div class="resume-actions">
            <el-button size="small" @click="previewResume">预览</el-button>
            <el-button size="small" type="primary" :icon="Download" @click="downloadResume">
              下载
            </el-button>
          </div>
        </div>
      </section>

      <!-- 跟进进度 -->
      <section class="detail-section">
        <div class="section-head">
          <h3>跟进进度</h3>
          <div class="section-actions">
            <el-button size="small" @click="addRemark">添加备注</el-button>
            <el-button
              v-if="!isLeadTerminal(lead.status)"
              size="small"
              type="primary"
              @click="handleAdvance"
            >
              推进状态
            </el-button>
          </div>
        </div>

        <el-steps :active="getLeadProgressStepIndex(lead.status)" finish-status="success" align-center class="recruitment-steps">
          <el-step
            v-for="step in progressSteps"
            :key="step.key"
            :title="step.label"
            :description="step.date"
          />
        </el-steps>
      </section>

      <!-- 流转记录 -->
      <section class="detail-section">
        <div class="section-head">
          <h3>流转记录</h3>
        </div>
        <el-timeline v-if="flowRecords.length">
          <el-timeline-item
            v-for="record in flowRecords"
            :key="record.id"
            :timestamp="formatDateTime(record.at)"
            placement="top"
          >
            <div class="flow-card">
              <div class="flow-title">{{ record.title }}</div>
              <div v-if="record.operator" class="flow-operator">{{ record.operator }}</div>
              <dl class="flow-details">
                <div v-for="item in record.details" :key="item.label" class="flow-detail-row">
                  <dt>{{ item.label }}</dt>
                  <dd>{{ item.value }}</dd>
                </div>
              </dl>
            </div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无流转记录" :image-size="64" />
      </section>
    </template>
  </el-drawer>
</template>

<style scoped>
.detail-section {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--app-border);
}

.detail-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item.span-2 {
  grid-column: span 2;
}

.info-label {
  font-size: 12px;
  color: #909399;
}

.info-value {
  font-size: 14px;
  color: #303133;
  line-height: 1.5;
}

.info-value.score {
  font-weight: 600;
  color: #e6a23c;
}

.info-value.warn {
  color: #e6a23c;
}

.skill-tag {
  margin-right: 4px;
}

.round-hint {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.edit-form {
  max-width: 480px;
}

.resume-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.resume-file {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #303133;
}

.resume-actions {
  display: flex;
  gap: 8px;
}

.recruitment-steps {
  margin-top: 4px;
}

.recruitment-steps :deep(.el-step__title) {
  font-size: 12px;
  line-height: 1.3;
}

.recruitment-steps :deep(.el-step__description) {
  font-size: 11px;
}

.recruitment-steps :deep(.el-step__head.is-process) {
  color: #e6a23c;
  border-color: #e6a23c;
}

.recruitment-steps :deep(.el-step__title.is-process) {
  color: #e6a23c;
  font-weight: 600;
}

.flow-card {
  padding: 12px 14px;
  background: #f5f7fa;
  border-radius: 8px;
}

.flow-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.flow-operator {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.flow-details {
  margin: 0;
}

.flow-detail-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  line-height: 1.6;
}

.flow-detail-row dt {
  margin: 0;
  color: #909399;
  flex-shrink: 0;
}

.flow-detail-row dd {
  margin: 0;
  color: #606266;
}
</style>
