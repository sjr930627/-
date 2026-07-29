<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  getNextLeadStatus,
  recruitmentLeadStatusMap,
  recruitmentLeadStatusType,
  recruitmentStatusOptions,
} from '@/constants/recruitment'
import type { RecruitmentLead, RecruitmentLeadStatus } from '@/types'

const store = useAppStore()
const route = useRoute()

const statusFilter = ref<RecruitmentLeadStatus | 'all'>('all')
const enterpriseFilter = ref('')
const requirementFilter = ref('')
const dialogVisible = ref(false)
const feedbackDialog = ref(false)
const advancingId = ref<string | null>(null)
const feedbackText = ref('')

const form = ref({
  requirementId: '',
  candidateName: '',
  phone: '',
  idCard: '',
  position: '',
  source: '',
  notes: '',
  interviewDate: '',
  interviewTime: '',
})

watch(
  () => route.query.req,
  (id) => {
    if (typeof id === 'string') requirementFilter.value = id
  },
  { immediate: true },
)

const statusCounts = computed(() => {
  const counts: Record<string, number> = { all: store.recruitmentLeads.length }
  for (const opt of recruitmentStatusOptions) {
    counts[opt.value] = store.recruitmentLeads.filter((l) => l.status === opt.value).length
  }
  return counts
})

const activeRequirements = computed(() =>
  store.jobRequirements.filter((r) => r.status === 'active'),
)

const tableData = computed(() =>
  store.recruitmentLeads
    .filter((l) => {
      if (statusFilter.value !== 'all' && l.status !== statusFilter.value) return false
      if (enterpriseFilter.value && l.enterpriseId !== enterpriseFilter.value) return false
      if (requirementFilter.value && l.requirementId !== requirementFilter.value) return false
      return true
    })
    .map((l) => ({
      ...l,
      statusLabel: recruitmentLeadStatusMap[l.status],
      statusType: recruitmentLeadStatusType[l.status],
      nextStatus: getNextLeadStatus(l.status),
      nextLabel: getNextLeadStatus(l.status)
        ? recruitmentLeadStatusMap[getNextLeadStatus(l.status)!]
        : null,
      updatedLabel: new Date(l.updatedAt).toLocaleString('zh-CN'),
    })),
)

function openCreate() {
  const req = activeRequirements.value[0]
  form.value = {
    requirementId: req?.id ?? '',
    candidateName: '',
    phone: '',
    idCard: '',
    position: req?.title ?? '',
    source: '',
    notes: '',
    interviewDate: '',
    interviewTime: '',
  }
  dialogVisible.value = true
}

function submitLead() {
  if (!form.value.requirementId || !form.value.candidateName.trim() || !form.value.phone.trim()) {
    ElMessage.warning('请填写必填项')
    return
  }
  const req = store.jobRequirements.find((r) => r.id === form.value.requirementId)
  if (!req) return

  store.addRecruitmentLead({
    requirementId: req.id,
    requirementTitle: req.title,
    enterpriseId: req.enterpriseId,
    enterpriseName: req.enterpriseName,
    candidateName: form.value.candidateName.trim(),
    phone: form.value.phone.trim(),
    idCard: form.value.idCard.trim() || undefined,
    position: form.value.position.trim() || req.title,
    source: form.value.source.trim() || '手动录入',
    status: 'screening',
    notes: form.value.notes.trim() || undefined,
    interviewDate: form.value.interviewDate || undefined,
    interviewTime: form.value.interviewTime || undefined,
  })
  ElMessage.success('线索已录入')
  dialogVisible.value = false
}

function advance(row: RecruitmentLead) {
  if (row.status === 'feedback_pending') {
    advancingId.value = row.id
    feedbackText.value = ''
    feedbackDialog.value = true
    return
  }
  if (row.status === 'interview_pending' && !row.interviewDate) {
    ElMessage.warning('请先安排面试日期')
    return
  }
  try {
    store.advanceLeadStatus(row.id)
    ElMessage.success('状态已更新')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

function submitFeedback() {
  if (!advancingId.value) return
  if (!feedbackText.value.trim()) {
    ElMessage.warning('请填写面试反馈')
    return
  }
  store.advanceLeadStatus(advancingId.value, feedbackText.value.trim())
  ElMessage.success('反馈已提交，状态已更新')
  feedbackDialog.value = false
}

async function closeLead(row: RecruitmentLead) {
  try {
    const { value } = await ElMessageBox.prompt('结束原因', '结束跟进', {
      inputPlaceholder: '请输入原因',
    })
    store.setLeadStatus(row.id, 'closed', value)
    ElMessage.success('已结束跟进')
  } catch {
    // cancelled
  }
}

async function scheduleInterview(row: RecruitmentLead) {
  try {
    const { value: date } = await ElMessageBox.prompt('面试日期 (YYYY-MM-DD)', '安排面试', {
      inputValue: row.interviewDate ?? '2026-07-28',
    })
    const { value: time } = await ElMessageBox.prompt('面试时间 (HH:mm)', '安排面试', {
      inputValue: row.interviewTime ?? '14:00',
    })
    store.updateRecruitmentLead(row.id, { interviewDate: date, interviewTime: time })
    ElMessage.success('面试已安排')
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">招聘进度</h2>
        <p class="text-muted">根据岗位录入人员跟进线索，管理全流程状态</p>
      </div>
      <el-button type="primary" @click="openCreate">录入线索</el-button>
    </div>

    <div class="status-pipeline">
      <div
        class="status-pipeline-item"
        :class="{ active: statusFilter === 'all' }"
        @click="statusFilter = 'all'"
      >
        全部<span class="count">{{ statusCounts.all }}</span>
      </div>
      <div
        v-for="opt in recruitmentStatusOptions"
        :key="opt.value"
        class="status-pipeline-item"
        :class="{ active: statusFilter === opt.value }"
        @click="statusFilter = opt.value as RecruitmentLeadStatus"
      >
        {{ opt.label }}<span class="count">{{ statusCounts[opt.value] ?? 0 }}</span>
      </div>
    </div>

    <div class="page-toolbar">
      <el-select v-model="enterpriseFilter" placeholder="企业" clearable style="width: 200px">
        <el-option v-for="e in store.enterprises" :key="e.id" :label="e.name" :value="e.id" />
      </el-select>
      <el-select v-model="requirementFilter" placeholder="岗位" clearable style="width: 200px">
        <el-option
          v-for="r in store.jobRequirements"
          :key="r.id"
          :label="r.title"
          :value="r.id"
        />
      </el-select>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="candidateName" label="姓名" width="90" />
      <el-table-column prop="phone" label="手机号" width="120" />
      <el-table-column prop="enterpriseName" label="企业" min-width="140" show-overflow-tooltip />
      <el-table-column prop="requirementTitle" label="岗位" min-width="130" />
      <el-table-column prop="source" label="来源" width="100" />
      <el-table-column label="面试安排" width="140">
        <template #default="{ row }">
          <span v-if="row.interviewDate">{{ row.interviewDate }} {{ row.interviewTime ?? '' }}</span>
          <span v-else class="text-muted">未安排</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag size="small" :type="row.statusType">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="updatedLabel" label="更新时间" width="170" />
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'screening' || row.status === 'interview_pending'"
            link
            type="primary"
            @click="scheduleInterview(row)"
          >
            安排面试
          </el-button>
          <el-button
            v-if="row.nextLabel && row.status !== 'closed'"
            link
            type="success"
            @click="advance(row)"
          >
            → {{ row.nextLabel }}
          </el-button>
          <el-button
            v-if="!['closed', 'settled'].includes(row.status)"
            link
            type="danger"
            @click="closeLead(row)"
          >
            结束
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" title="录入跟进线索" width="560px">
    <el-form label-width="90px">
      <el-form-item label="关联岗位" required>
        <el-select v-model="form.requirementId" style="width: 100%">
          <el-option
            v-for="r in activeRequirements"
            :key="r.id"
            :label="`${r.enterpriseName} - ${r.title}`"
            :value="r.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="姓名" required>
        <el-input v-model="form.candidateName" />
      </el-form-item>
      <el-form-item label="手机号" required>
        <el-input v-model="form.phone" />
      </el-form-item>
      <el-form-item label="身份证号">
        <el-input v-model="form.idCard" placeholder="脱敏存储" />
      </el-form-item>
      <el-form-item label="来源">
        <el-input v-model="form.source" placeholder="Boss直聘 / 内推" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.notes" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submitLead">录入（待筛选）</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="feedbackDialog" title="面试反馈" width="480px">
    <el-input
      v-model="feedbackText"
      type="textarea"
      :rows="4"
      placeholder="请填写面试评价与反馈..."
    />
    <template #footer>
      <el-button @click="feedbackDialog = false">取消</el-button>
      <el-button type="primary" @click="submitFeedback">提交并推进至待入职</el-button>
    </template>
  </el-dialog>
</template>
