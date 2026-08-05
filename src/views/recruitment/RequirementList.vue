<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import {
  ATTENDANCE_DURATION_OPTIONS,
  ATTENDANCE_TIME_SLOT_OPTIONS,
  ATTENDANCE_WEEKLY_DAYS_OPTIONS,
  DEFAULT_ATTENDANCE_CONFIG,
  DEFAULT_BENEFITS_CONFIG,
  JOB_BENEFIT_TAG_PRESETS,
  MARKETING_TAG_PRESETS,
  SKILL_OPTIONS,
  JOB_TYPE_OPTIONS,
  employmentTypeMap,
  formatSalaryRange,
  jobRequirementStatusMap,
  jobRequirementStatusType,
  urgencyLevelMap,
} from '@/constants/recruitment'
import type {
  EmploymentType,
  JobBenefitTag,
  JobModuleFieldConfig,
  JobRequirement,
  UrgencyLevel,
} from '@/types'

const store = useAppStore()
const router = useRouter()
const { isPlatform, isEnterprise, portalPath } = usePortal()

const drawerVisible = ref(false)
const importDialogVisible = ref(false)
const editingId = ref<string | null>(null)
const enterpriseFilter = ref('')
const statusFilter = ref<'all' | JobRequirement['status']>('all')
const keywordFilter = ref('')
const pmFilter = ref('')

const defaultForm = () => ({
  enterpriseId: isEnterprise.value ? store.currentEnterpriseId : store.enterprises[0]?.id ?? '',
  title: '',
  department: '',
  headcount: 5,
  salaryMin: 4000,
  salaryMax: 8000,
  location: '',
  city: '',
  jobType: '零售服务',
  employmentType: 'part_time' as EmploymentType,
  workDuration: '',
  ageMin: undefined as number | undefined,
  ageMax: undefined as number | undefined,
  gender: 'any' as 'any' | 'male' | 'female',
  experience: '',
  skills: [] as string[],
  tags: [] as string[],
  urgency: 'normal' as UrgencyLevel,
  interviewRounds: 1,
  projectManager: '',
  description: '',
  requirements: '',
  remarks: '',
  attendanceConfig: { ...DEFAULT_ATTENDANCE_CONFIG } as JobModuleFieldConfig,
  attendanceSubtitle: '面试通过后，稳定派单出勤时间要求',
  attendanceDuration: '不限',
  attendanceWeeklyDays: '不限',
  attendanceTimeSlots: '不限',
  benefitsConfig: { ...DEFAULT_BENEFITS_CONFIG } as JobModuleFieldConfig,
  benefitTags: [] as JobBenefitTag[],
  bonusText: '',
})

const form = ref(defaultForm())

const scopedRequirements = computed(() => {
  let list = store.jobRequirements
  if (isEnterprise.value) {
    list = list.filter((r) => r.enterpriseId === store.currentEnterpriseId)
  }
  return list
})

const statusStats = computed(() => ({
  all: scopedRequirements.value.length,
  pending: scopedRequirements.value.filter((r) => r.status === 'pending').length,
  recruiting: scopedRequirements.value.filter((r) => r.status === 'recruiting').length,
  completed: scopedRequirements.value.filter((r) => r.status === 'completed').length,
}))

const tableData = computed(() =>
  scopedRequirements.value
    .filter((r) => {
      if (enterpriseFilter.value && r.enterpriseId !== enterpriseFilter.value) return false
      if (statusFilter.value !== 'all' && r.status !== statusFilter.value) return false
      if (pmFilter.value && r.projectManager !== pmFilter.value) return false
      if (keywordFilter.value) {
        const kw = keywordFilter.value.toLowerCase()
        if (!r.title.toLowerCase().includes(kw) && !r.enterpriseName.toLowerCase().includes(kw)) {
          return false
        }
      }
      return true
    })
    .map((r) => ({
      ...r,
      statusLabel: jobRequirementStatusMap[r.status],
      statusType: jobRequirementStatusType[r.status],
      salaryLabel: formatSalaryRange(r.salaryMin, r.salaryMax),
      progressLabel: `${r.filledCount}/${r.headcount}`,
      urgencyLabel: r.urgency ? urgencyLevelMap[r.urgency] : '普通',
      roundsLabel: `${r.interviewRounds ?? 1} 轮`,
    })),
)

const pmOptions = computed(() =>
  [...new Set(scopedRequirements.value.map((r) => r.projectManager).filter(Boolean))] as string[],
)

function openCreate() {
  editingId.value = null
  form.value = defaultForm()
  if (isEnterprise.value) {
    form.value.enterpriseId = store.currentEnterpriseId
  }
  drawerVisible.value = true
}

function openEdit(row: JobRequirement) {
  if (row.status === 'completed') {
    ElMessage.warning('已完成需求不可编辑')
    return
  }
  if (isEnterprise.value && !['pending', 'recruiting'].includes(row.status)) {
    ElMessage.warning('仅待开始/招聘中状态可编辑')
    return
  }
  editingId.value = row.id
  const legacyBenefits = (row.benefits ?? '')
    .split(/[、,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const benefitTags =
    row.benefitTags?.length
      ? row.benefitTags.map((b) => ({ ...b }))
      : legacyBenefits.map((title) => {
          const preset = JOB_BENEFIT_TAG_PRESETS.find((p) => p.title === title)
          return preset ?? { icon: '🎁', title, desc: title }
        })

  form.value = {
    enterpriseId: row.enterpriseId,
    title: row.title,
    department: row.department,
    headcount: row.headcount,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    location: row.location,
    city: row.city ?? '',
    jobType: row.jobType ?? '零售服务',
    employmentType: row.employmentType ?? 'part_time',
    workDuration: row.workDuration ?? '',
    ageMin: row.ageMin,
    ageMax: row.ageMax,
    gender: row.gender ?? 'any',
    experience: row.experience ?? '',
    skills: [...(row.skills ?? [])],
    tags: [...(row.tags ?? [])],
    urgency: row.urgency ?? 'normal',
    interviewRounds: row.interviewRounds ?? 1,
    projectManager: row.projectManager ?? '',
    description: row.description,
    requirements: row.requirements ?? '',
    remarks: row.remarks ?? '',
    attendanceConfig: { ...DEFAULT_ATTENDANCE_CONFIG, ...row.attendanceConfig },
    attendanceSubtitle: row.attendanceRequirement?.subtitle ?? '面试通过后，稳定派单出勤时间要求',
    attendanceDuration: row.attendanceRequirement?.duration ?? '不限',
    attendanceWeeklyDays: row.attendanceRequirement?.weeklyDays ?? '不限',
    attendanceTimeSlots: row.attendanceRequirement?.timeSlots ?? '不限',
    benefitsConfig: { ...DEFAULT_BENEFITS_CONFIG, ...row.benefitsConfig },
    benefitTags,
    bonusText: row.bonusText ?? '',
  }
  drawerVisible.value = true
}

function toggleBenefitPreset(preset: JobBenefitTag) {
  const idx = form.value.benefitTags.findIndex((b) => b.title === preset.title)
  if (idx >= 0) {
    form.value.benefitTags.splice(idx, 1)
  } else {
    form.value.benefitTags.push({ ...preset })
  }
}

function isBenefitSelected(title: string) {
  return form.value.benefitTags.some((b) => b.title === title)
}

function submit() {
  if (!form.value.title.trim() || !form.value.enterpriseId) {
    ElMessage.warning('请填写完整信息')
    return
  }
  if (form.value.attendanceConfig.showInMiniapp) {
    if (
      !form.value.attendanceDuration.trim() ||
      !form.value.attendanceWeeklyDays.trim() ||
      !form.value.attendanceTimeSlots.trim()
    ) {
      ElMessage.warning('已勾选小程序展示，请完整填写出勤时间要求')
      return
    }
  }
  if (form.value.benefitsConfig.showInMiniapp && form.value.benefitTags.length === 0) {
    ElMessage.warning('已勾选小程序展示，请至少选择一个福利待遇标签')
    return
  }

  const ent = store.enterprises.find((e) => e.id === form.value.enterpriseId)
  if (!ent) return

  const benefitTags = form.value.benefitTags.map((b) => ({
    icon: b.icon,
    title: b.title.trim(),
    desc: b.desc.trim(),
  }))

  const payload = {
    enterpriseId: ent.id,
    enterpriseName: ent.name,
    title: form.value.title.trim(),
    department: form.value.department.trim() || '未分配',
    headcount: form.value.headcount,
    salaryMin: form.value.salaryMin,
    salaryMax: form.value.salaryMax,
    location: form.value.location.trim(),
    city: form.value.city.trim() || undefined,
    jobType: form.value.jobType,
    employmentType: form.value.employmentType,
    workDuration: form.value.workDuration.trim() || undefined,
    ageMin: form.value.ageMin,
    ageMax: form.value.ageMax,
    gender: form.value.gender,
    experience: form.value.experience.trim() || undefined,
    skills: form.value.skills,
    benefits: benefitTags.map((b) => b.title).join('、') || undefined,
    benefitTags,
    bonusText: form.value.bonusText.trim() || undefined,
    attendanceRequirement: {
      subtitle: form.value.attendanceSubtitle.trim() || undefined,
      duration: form.value.attendanceDuration.trim() || undefined,
      weeklyDays: form.value.attendanceWeeklyDays.trim() || undefined,
      timeSlots: form.value.attendanceTimeSlots.trim() || undefined,
    },
    attendanceConfig: { ...form.value.attendanceConfig },
    benefitsConfig: { ...form.value.benefitsConfig },
    tags: isPlatform.value ? form.value.tags : undefined,
    urgency: form.value.urgency,
    interviewRounds: form.value.interviewRounds,
    projectManager: form.value.projectManager.trim() || undefined,
    description: form.value.description.trim(),
    requirements: form.value.requirements.trim() || undefined,
    remarks: form.value.remarks.trim() || undefined,
    status: 'pending' as const,
  }

  if (editingId.value) {
    store.updateJobRequirement(editingId.value, payload)
    ElMessage.success('更新成功')
  } else {
    store.addJobRequirement(payload)
    ElMessage.success(isEnterprise.value ? '需求已提交，状态为待开始' : '创建成功')
  }
  drawerVisible.value = false
}

async function startRecruiting(row: JobRequirement) {
  await ElMessageBox.confirm(`安排招聘人员，将「${row.title}」流转为招聘中？`, '安排确认')
  store.publishJobRequirement(row.id)
  ElMessage.success('已流转为招聘中')
}

async function completeReq(row: JobRequirement) {
  await ElMessageBox.confirm(`结束需求「${row.title}」，状态置为已完成？`, '结束确认', {
    type: 'warning',
  })
  store.closeJobRequirement(row.id)
  ElMessage.success('需求已结束')
}

function viewProgress(row: JobRequirement) {
  router.push(portalPath(`/recruitment/progress?req=${row.id}`))
}

function generatePoster(row: JobRequirement) {
  ElMessage.success(`已生成「${row.title}」招聘海报（演示）`)
}

function confirmImport() {
  importDialogVisible.value = false
  ElMessage.success('批量导入成功（演示）')
}

function filterByStatus(status: typeof statusFilter.value) {
  statusFilter.value = status
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">需求管理</h2>
        <p class="text-muted">
          {{ isEnterprise ? '发布/编辑本企业岗位需求，查看招聘进度' : '审核、发布、编辑需求，批量导入与线索管理' }}
        </p>
      </div>
      <div class="header-actions">
        <el-button v-if="isPlatform" @click="importDialogVisible = true">批量导入</el-button>
        <el-button type="primary" @click="openCreate">
          {{ isEnterprise ? '发布新需求' : '新建需求' }}
        </el-button>
      </div>
    </div>

    <div class="stat-cards">
      <div
        class="stat-card tone-all"
        :class="{ active: statusFilter === 'all' }"
        @click="filterByStatus('all')"
      >
        <div class="stat-value">{{ statusStats.all }}</div>
        <div class="stat-label">全部</div>
      </div>
      <div
        class="stat-card tone-pending"
        :class="{ active: statusFilter === 'pending' }"
        @click="filterByStatus('pending')"
      >
        <div class="stat-value">{{ statusStats.pending }}</div>
        <div class="stat-label">待开始</div>
      </div>
      <div
        class="stat-card tone-recruiting"
        :class="{ active: statusFilter === 'recruiting' }"
        @click="filterByStatus('recruiting')"
      >
        <div class="stat-value">{{ statusStats.recruiting }}</div>
        <div class="stat-label">招聘中</div>
      </div>
      <div
        class="stat-card tone-completed"
        :class="{ active: statusFilter === 'completed' }"
        @click="filterByStatus('completed')"
      >
        <div class="stat-value">{{ statusStats.completed }}</div>
        <div class="stat-label">已完成</div>
      </div>
    </div>

    <div class="page-toolbar">
      <el-select
        v-if="isPlatform"
        v-model="enterpriseFilter"
        placeholder="选择企业"
        clearable
        style="width: 200px"
      >
        <el-option v-for="e in store.enterprises" :key="e.id" :label="e.name" :value="e.id" />
      </el-select>
      <el-select v-if="isPlatform" v-model="pmFilter" placeholder="项目经理" clearable style="width: 140px">
        <el-option v-for="pm in pmOptions" :key="pm" :label="pm" :value="pm" />
      </el-select>
      <el-input v-model="keywordFilter" placeholder="关键词搜索" clearable style="width: 180px" />
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column v-if="isPlatform" prop="enterpriseName" label="企业" min-width="140" />
      <el-table-column prop="title" label="岗位名称" min-width="140" />
      <el-table-column prop="jobType" label="岗位类型" width="100" />
      <el-table-column prop="salaryLabel" label="薪资范围" width="100" />
      <el-table-column prop="location" label="工作地点" min-width="120" />
      <el-table-column v-if="isPlatform" prop="projectManager" label="项目经理" width="100" />
      <el-table-column prop="roundsLabel" label="面试轮次" width="90" align="center" />
      <el-table-column label="招聘进度" width="100" align="center">
        <template #default="{ row }">
          <el-progress
            :percentage="Math.round((row.filledCount / row.headcount) * 100)"
            :stroke-width="6"
            :format="() => row.progressLabel"
          />
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.statusType">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" :width="isPlatform ? 280 : 220" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status !== 'completed'" link type="primary" @click="openEdit(row)">
            编辑
          </el-button>
          <el-button
            v-if="isPlatform && row.status === 'pending'"
            link
            type="success"
            @click="startRecruiting(row)"
          >
            安排招聘
          </el-button>
          <el-button v-if="row.status === 'recruiting'" link type="warning" @click="completeReq(row)">
            结束
          </el-button>
          <el-button link @click="viewProgress(row)">看进度</el-button>
          <el-button v-if="isPlatform" link @click="generatePoster(row)">生成海报</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-drawer
    v-model="drawerVisible"
    :title="editingId ? '编辑需求' : '发布岗位需求'"
    size="720px"
    direction="rtl"
  >
    <el-form label-width="100px" label-position="left">
      <el-form-item label="所属企业" required>
        <el-select v-model="form.enterpriseId" :disabled="isEnterprise || !!editingId" style="width: 100%">
          <el-option v-for="e in store.enterprises" :key="e.id" :label="e.name" :value="e.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="岗位名称" required>
        <el-input v-model="form.title" :disabled="!!editingId && isEnterprise" placeholder="如：加油站营业员" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="需求人数">
            <el-input-number v-model="form.headcount" :min="1" :max="999" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="用工类型">
            <el-select v-model="form.employmentType" style="width: 100%">
              <el-option v-for="(label, key) in employmentTypeMap" :key="key" :label="label" :value="key" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="薪资范围">
        <el-input-number v-model="form.salaryMin" :min="1000" :step="500" /> —
        <el-input-number v-model="form.salaryMax" :min="form.salaryMin" :step="500" /> 元/月
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="所属城市">
            <el-input v-model="form.city" placeholder="北京" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="岗位类型">
            <el-select v-model="form.jobType" style="width: 100%">
              <el-option v-for="t in JOB_TYPE_OPTIONS" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="工作地点">
        <el-input v-model="form.location" placeholder="可多个，逗号分隔" />
      </el-form-item>
      <el-form-item label="工作时长">
        <el-input v-model="form.workDuration" placeholder="如：每天8小时，双休" />
      </el-form-item>
      <el-form-item label="技能要求">
        <el-checkbox-group v-model="form.skills">
          <el-checkbox v-for="s in SKILL_OPTIONS" :key="s" :value="s">{{ s }}</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="紧急程度">
            <el-select v-model="form.urgency" style="width: 100%">
              <el-option v-for="(label, key) in urgencyLevelMap" :key="key" :label="label" :value="key" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="面试轮次">
            <el-input-number v-model="form.interviewRounds" :min="1" :max="5" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item v-if="isPlatform" label="项目经理">
        <el-input v-model="form.projectManager" placeholder="负责该需求的运营人员" />
      </el-form-item>

      <div class="form-section">
        <div class="form-section-head">
          <span class="form-section-title">出勤时间要求</span>
          <span class="form-section-hint">对齐小程序「出勤时间要求」模块</span>
        </div>
        <div class="config-toggles">
          <el-checkbox v-model="form.attendanceConfig.showInMiniapp">小程序展示（勾选则必填）</el-checkbox>
        </div>
        <el-form-item label="说明文案">
          <el-input
            v-model="form.attendanceSubtitle"
            placeholder="面试通过后，稳定派单出勤时间要求"
          />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="期望兼职时长" :required="form.attendanceConfig.showInMiniapp">
              <el-select
                v-model="form.attendanceDuration"
                filterable
                allow-create
                default-first-option
                style="width: 100%"
              >
                <el-option v-for="o in ATTENDANCE_DURATION_OPTIONS" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="每周出勤天数" :required="form.attendanceConfig.showInMiniapp">
              <el-select
                v-model="form.attendanceWeeklyDays"
                filterable
                allow-create
                default-first-option
                style="width: 100%"
              >
                <el-option v-for="o in ATTENDANCE_WEEKLY_DAYS_OPTIONS" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="具体出勤时段" :required="form.attendanceConfig.showInMiniapp">
              <el-select
                v-model="form.attendanceTimeSlots"
                filterable
                allow-create
                default-first-option
                style="width: 100%"
              >
                <el-option v-for="o in ATTENDANCE_TIME_SLOT_OPTIONS" :key="o" :label="o" :value="o" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <div class="form-section">
        <div class="form-section-head">
          <span class="form-section-title">福利待遇标签</span>
          <span class="form-section-hint">对齐小程序「您将享受的福利」模块</span>
        </div>
        <div class="config-toggles">
          <el-checkbox v-model="form.benefitsConfig.showInMiniapp">小程序展示（勾选则必填）</el-checkbox>
        </div>
        <el-form-item label="福利标签" :required="form.benefitsConfig.showInMiniapp">
          <div class="benefit-preset-grid">
            <button
              v-for="preset in JOB_BENEFIT_TAG_PRESETS"
              :key="preset.title"
              type="button"
              class="benefit-preset"
              :class="{ selected: isBenefitSelected(preset.title) }"
              @click="toggleBenefitPreset(preset)"
            >
              <span class="benefit-preset-icon">{{ preset.icon }}</span>
              <span class="benefit-preset-title">{{ preset.title }}</span>
              <span class="benefit-preset-desc">{{ preset.desc }}</span>
            </button>
          </div>
        </el-form-item>
        <el-form-item label="福利亮点">
          <el-input
            v-model="form.bonusText"
            placeholder="如：570元加薪券（展示在福利模块底部）"
            maxlength="80"
            show-word-limit
          />
        </el-form-item>
      </div>

      <el-form-item v-if="isPlatform" label="营销标签">
        <el-select v-model="form.tags" multiple filterable allow-create style="width: 100%">
          <el-option v-for="t in MARKETING_TAG_PRESETS" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>
      <el-form-item label="岗位描述">
        <el-input v-model="form.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
      </el-form-item>
      <el-form-item label="任职要求">
        <el-input v-model="form.requirements" type="textarea" :rows="2" maxlength="500" show-word-limit />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remarks" type="textarea" :rows="2" maxlength="500" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="drawerVisible = false">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-drawer>

  <el-dialog v-model="importDialogVisible" title="批量导入需求" width="520px">
    <p class="text-muted">下载模板后填写，支持 .xlsx / .csv 格式（演示：确认后直接导入示例数据）</p>
    <el-button link type="primary">下载导入模板</el-button>
    <el-upload drag action="#" :auto-upload="false" style="margin-top: 16px">
      <div class="el-upload__text">拖拽文件到此处或 <em>点击上传</em></div>
    </el-upload>
    <template #footer>
      <el-button @click="importDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmImport">
        确认导入
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.header-actions {
  display: flex;
  gap: 8px;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  padding: 16px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.stat-card:hover,
.stat-card.active {
  box-shadow: 0 0 0 1px currentColor inset;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
}

.stat-label {
  font-size: 13px;
  color: #606266;
  margin-top: 4px;
}

.tone-all {
  color: #c45656;
  background: #fef0f0;
}

.tone-pending {
  color: #7a6bb5;
  background: #f4f0ff;
}

.tone-recruiting {
  color: #2f8f7a;
  background: #eef9f5;
}

.tone-completed {
  color: #b88230;
  background: #fdf6ec;
}

.form-section {
  margin: 8px 0 20px;
  padding: 14px 16px 4px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fafbfc;
}

.form-section-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
}

.form-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.form-section-hint {
  font-size: 12px;
  color: #909399;
}

.config-toggles {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.benefit-preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

.benefit-preset {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}

.benefit-preset:hover {
  border-color: var(--app-primary);
}

.benefit-preset.selected {
  border-color: var(--app-primary);
  background: var(--app-primary-light);
}

.benefit-preset-icon {
  font-size: 16px;
  line-height: 1.2;
}

.benefit-preset-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.benefit-preset-desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
</style>
