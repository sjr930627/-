<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import {
  formatRoundHint,
  getAvailableTransitions,
  isLeadTerminal,
  recruitmentLeadStatusMap,
  recruitmentLeadStatusType,
  recruitmentStatusOptions,
} from '@/constants/recruitment'
import type { RecruitmentLead, RecruitmentLeadStatus } from '@/types'
import LeadStatusTransitionDialog from '@/components/recruitment/LeadStatusTransitionDialog.vue'
import RecruitmentLeadDetailDrawer from '@/components/recruitment/RecruitmentLeadDetailDrawer.vue'

const store = useAppStore()
const route = useRoute()
const { isEnterprise } = usePortal()

const statusFilter = ref<RecruitmentLeadStatus | 'all'>('all')
const enterpriseFilter = ref('')
const requirementFilter = ref('')
const dialogVisible = ref(false)
const transitionDialog = ref(false)
const detailDrawer = ref(false)
const detailLeadId = ref<string | null>(null)
const transitionLead = ref<RecruitmentLead | null>(null)
const highlightLeadId = ref<string | null>(null)

const form = ref({
  requirementId: '',
  candidateName: '',
  phone: '',
  idCard: '',
  position: '',
  source: '',
  notes: '',
})

watch(
  () => route.query.req,
  (id) => {
    if (typeof id === 'string') requirementFilter.value = id
  },
  { immediate: true },
)

watch(
  () => route.query.lead,
  async (id) => {
    if (typeof id !== 'string') {
      highlightLeadId.value = null
      return
    }
    const lead = store.recruitmentLeads.find((l) => l.id === id)
    if (!lead) return
    highlightLeadId.value = id
    statusFilter.value = lead.status
    enterpriseFilter.value = lead.enterpriseId
    requirementFilter.value = lead.requirementId
    await nextTick()
    document.querySelector(`[data-lead-id="${id}"]`)?.scrollIntoView({ block: 'center' })
  },
  { immediate: true },
)

const scopedLeads = computed(() => {
  let list = store.recruitmentLeads
  if (isEnterprise.value) {
    list = list.filter((l) => l.enterpriseId === store.currentEnterpriseId)
  }
  return list
})

const statusCounts = computed(() => {
  const counts: Record<string, number> = { all: scopedLeads.value.length }
  for (const opt of recruitmentStatusOptions) {
    counts[opt.value] = scopedLeads.value.filter((l) => l.status === opt.value).length
  }
  return counts
})

const recruitingRequirements = computed(() =>
  store.jobRequirements.filter((r) => r.status === 'recruiting'),
)

const tableData = computed(() =>
  scopedLeads.value
    .filter((l) => {
      if (statusFilter.value !== 'all' && l.status !== statusFilter.value) return false
      if (enterpriseFilter.value && l.enterpriseId !== enterpriseFilter.value) return false
      if (requirementFilter.value && l.requirementId !== requirementFilter.value) return false
      return true
    })
    .map((l) => {
      const req = store.jobRequirements.find((r) => r.id === l.requirementId)
      const totalRounds = l.totalRounds ?? req?.interviewRounds ?? 1
      return {
        ...l,
        totalRounds,
        currentRound: l.currentRound ?? 1,
        statusLabel: recruitmentLeadStatusMap[l.status],
        statusType: recruitmentLeadStatusType[l.status],
        roundHint: formatRoundHint({ ...l, totalRounds }),
        transitions: getAvailableTransitions(l.status, { ...l, totalRounds }),
        updatedLabel: new Date(l.updatedAt).toLocaleString('zh-CN'),
      }
    }),
)

function openCreate() {
  const req = recruitingRequirements.value[0]
  form.value = {
    requirementId: req?.id ?? '',
    candidateName: '',
    phone: '',
    idCard: '',
    position: req?.title ?? '',
    source: '',
    notes: '',
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
    currentRound: 1,
    totalRounds: req.interviewRounds ?? 1,
    notes: form.value.notes.trim() || undefined,
  })
  ElMessage.success('线索已录入')
  dialogVisible.value = false
}

function openDetail(row: RecruitmentLead) {
  detailLeadId.value = row.id
  detailDrawer.value = true
}

function openTransitionFromDetail(lead: RecruitmentLead) {
  transitionLead.value = lead
  transitionDialog.value = true
}

function openTransition(row: RecruitmentLead) {
  transitionLead.value = row
  transitionDialog.value = true
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
    if (row.status === 'screening') {
      store.transitionLeadStatus(row.id, 'interview_pending')
    }
    ElMessage.success('面试已安排')
  } catch {
    // cancelled
  }
}

function leadRowClassName({ row }: { row: RecruitmentLead }) {
  return row.id === highlightLeadId.value ? 'lead-row-highlight' : ''
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">招聘进度</h2>
        <p class="text-muted">候选人 × 需求维度的 10 态状态机流转与动态字段编辑</p>
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
      <el-select v-if="!isEnterprise" v-model="enterpriseFilter" placeholder="企业" clearable style="width: 200px">
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

    <el-table :data="tableData" border stripe :row-class-name="leadRowClassName">
      <el-table-column prop="candidateName" label="姓名" width="90">
        <template #default="{ row }">
          <span :data-lead-id="row.id">{{ row.candidateName }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" width="120" />
      <el-table-column prop="enterpriseName" label="企业" min-width="130" show-overflow-tooltip />
      <el-table-column prop="requirementTitle" label="岗位" min-width="120" />
      <el-table-column prop="source" label="来源" width="90" />
      <el-table-column label="轮次" width="70" align="center">
        <template #default="{ row }">{{ row.currentRound }}/{{ row.totalRounds }}</template>
      </el-table-column>
      <el-table-column label="面试安排" width="140">
        <template #default="{ row }">
          <span v-if="row.interviewDate">{{ row.interviewDate }} {{ row.interviewTime ?? '' }}</span>
          <span v-else class="text-muted">未安排</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag size="small" :type="row.statusType">{{ row.statusLabel }}</el-tag>
          <el-tag v-if="row.ext?.deviated" size="small" type="warning" class="deviate-tag">偏离</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="updatedLabel" label="更新时间" width="160" />
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <el-button
            v-if="row.status === 'screening' || row.status === 'interview_pending'"
            link
            type="primary"
            @click="scheduleInterview(row)"
          >
            安排面试
          </el-button>
          <el-button
            v-if="row.transitions.length && !isLeadTerminal(row.status)"
            link
            type="success"
            @click="openTransition(row)"
          >
            编辑状态
          </el-button>
          <el-button v-if="!isLeadTerminal(row.status)" link type="danger" @click="closeLead(row)">
            结束
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <RecruitmentLeadDetailDrawer
    v-model="detailDrawer"
    :lead-id="detailLeadId"
    @advance="openTransitionFromDetail"
  />

  <LeadStatusTransitionDialog
    v-model="transitionDialog"
    :lead="transitionLead"
  />

  <el-dialog v-model="dialogVisible" title="录入跟进线索" width="560px">
    <el-form label-width="90px">
      <el-form-item label="关联岗位" required>
        <el-select v-model="form.requirementId" style="width: 100%">
          <el-option
            v-for="r in recruitingRequirements"
            :key="r.id"
            :label="`${r.enterpriseName} - ${r.title}`"
            :value="r.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="姓名" required><el-input v-model="form.candidateName" /></el-form-item>
      <el-form-item label="手机号" required><el-input v-model="form.phone" /></el-form-item>
      <el-form-item label="来源"><el-input v-model="form.source" placeholder="Boss直聘 / 内推" /></el-form-item>
      <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submitLead">录入（待筛选）</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
:deep(.lead-row-highlight) {
  background: #fff7ed !important;
}

.deviate-tag {
  margin-left: 4px;
}

.round-hint {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
