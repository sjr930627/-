<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useTrainingScope } from '@/composables/useTrainingScope'
import { trainingOwnerTypeOptions, trainingTypeFilterOptions } from '@/constants/trainingOwner'
import {
  courseStatusMap,
  courseStatusTagType,
  courseStudyModeOptions,
} from '@/constants/training'
import {
  isGlobalTrainingOwner,
  type TrainingOwnerScope,
} from '@/services/training'
import type { CourseStudyMode, TrainingCourse } from '@/types'

const store = useAppStore()
const router = useRouter()
const {
  isPlatform,
  isEnterprise,
  typeFilter,
  enterpriseFilter,
  defaultEnterpriseId,
  filterByTrainingType,
  filterPeersForOwner,
  ownerTypeLabel,
  progressPath,
} = useTrainingScope()

const statusFilter = ref<'all' | TrainingCourse['status']>('all')
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const form = ref({
  ownerType: 'enterprise' as TrainingOwnerScope,
  enterpriseId: defaultEnterpriseId.value as string | null,
  name: '',
  description: '',
  materialIds: [] as string[],
  studyMode: 'required' as CourseStudyMode,
  videoNoSeek: true,
  minStudyMinutes: undefined as number | undefined,
})

const formOwnerEnterpriseId = computed(() =>
  form.value.ownerType === 'global' ? null : form.value.enterpriseId,
)

const approvedMaterials = computed(() =>
  filterPeersForOwner(
    store.trainingMaterials.filter((m) => m.status === 'approved'),
    formOwnerEnterpriseId.value,
  ),
)

watch(
  () => form.value.ownerType,
  (t) => {
    if (t === 'global') {
      form.value.enterpriseId = null
    } else if (!form.value.enterpriseId) {
      form.value.enterpriseId = defaultEnterpriseId.value
    }
  },
)

watch(
  () => form.value.enterpriseId,
  () => {
    const materialIds = new Set(approvedMaterials.value.map((m) => m.id))
    form.value.materialIds = form.value.materialIds.filter((id) => materialIds.has(id))
  },
)

const tableData = computed(() =>
  filterByTrainingType(store.trainingCourses)
    .filter((c) => statusFilter.value === 'all' || c.status === statusFilter.value)
    .map((c) => {
      const enterpriseName = isGlobalTrainingOwner(c.enterpriseId)
        ? '-'
        : store.enterprises.find((e) => e.id === c.enterpriseId)?.shortName ||
          store.enterprises.find((e) => e.id === c.enterpriseId)?.name ||
          '-'
      return {
        ...c,
        ownerTypeLabel: ownerTypeLabel(c.enterpriseId),
        statusLabel: courseStatusMap[c.status],
        statusTag: courseStatusTagType[c.status],
        materialCount: c.materialIds.length,
        enterpriseName,
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

function openCreate() {
  editingId.value = null
  form.value = {
    ownerType: 'enterprise',
    enterpriseId: defaultEnterpriseId.value,
    name: '',
    description: '',
    materialIds: [],
    studyMode: 'required',
    videoNoSeek: true,
    minStudyMinutes: undefined,
  }
  dialogVisible.value = true
}

function openEdit(row: TrainingCourse) {
  if (row.status === 'published') {
    ElMessage.warning('已发布课程不可编辑，请先下架')
    return
  }
  editingId.value = row.id
  form.value = {
    ownerType: isGlobalTrainingOwner(row.enterpriseId) ? 'global' : 'enterprise',
    enterpriseId: row.enterpriseId ?? defaultEnterpriseId.value,
    name: row.name,
    description: row.description ?? '',
    materialIds: [...row.materialIds],
    studyMode:
      row.studyMode === 'optional' || (row.studyMode as string) === 'free'
        ? 'optional'
        : 'required',
    videoNoSeek: row.videoNoSeek,
    minStudyMinutes: row.minStudyMinutes,
  }
  dialogVisible.value = true
}

function submit() {
  const isGlobal = form.value.ownerType === 'global'
  if (!isGlobal && !form.value.enterpriseId) {
    ElMessage.warning('请选择所属企业')
    return
  }
  if (!form.value.name.trim() || form.value.materialIds.length === 0) {
    ElMessage.warning('请填写课程名称并关联至少一项资料')
    return
  }

  const payload = {
    enterpriseId: isGlobal ? null : form.value.enterpriseId,
    name: form.value.name.trim(),
    description: form.value.description.trim(),
    materialIds: form.value.materialIds,
    studyMode: form.value.studyMode,
    videoNoSeek: form.value.videoNoSeek,
    minStudyMinutes: form.value.minStudyMinutes,
    scopeType: 'all' as const,
    scopeDepartmentIds: undefined,
    scopeTags: undefined,
    validFrom: undefined,
    validTo: undefined,
    status: 'draft' as const,
  }
  try {
    if (editingId.value) {
      store.updateTrainingCourse(editingId.value, payload)
      ElMessage.success('更新成功')
    } else {
      store.addTrainingCourse(payload)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function publish(row: TrainingCourse) {
  await ElMessageBox.confirm(`发布课程「${row.name}」？发布后将不可编辑。`, '发布确认')
  try {
    store.publishTrainingCourse(row.id)
    ElMessage.success('已发布')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '发布失败')
  }
}

async function offlineCourse(row: TrainingCourse) {
  await ElMessageBox.confirm(`下架课程「${row.name}」？下架后可重新编辑并上架。`, '下架确认', {
    type: 'warning',
  })
  try {
    store.offlineTrainingCourse(row.id)
    ElMessage.success('已下架')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '下架失败')
  }
}

async function republishCourse(row: TrainingCourse) {
  await ElMessageBox.confirm(`重新上架课程「${row.name}」？`, '上架确认')
  try {
    store.republishTrainingCourse(row.id)
    ElMessage.success('已重新上架')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '上架失败')
  }
}

async function closeCourse(row: TrainingCourse) {
  await ElMessageBox.confirm(`关闭课程「${row.name}」？`, '提示', { type: 'warning' })
  store.closeTrainingCourse(row.id)
  ElMessage.success('已关闭')
}

function viewProgress(courseId: string) {
  router.push(progressPath(courseId))
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">课程管理</h2>
        <p class="text-muted">按类型区分企业课程与通用课程，可关联资料并配置学习要求</p>
      </div>
      <el-button type="primary" @click="openCreate">创建课程</el-button>
    </div>

    <div class="page-toolbar">
      <el-select v-if="isPlatform" v-model="typeFilter" placeholder="类型" style="width: 120px">
        <el-option
          v-for="o in trainingTypeFilterOptions"
          :key="o.value"
          :label="o.label"
          :value="o.value"
        />
      </el-select>
      <el-select
        v-if="isPlatform && typeFilter !== 'global'"
        v-model="enterpriseFilter"
        placeholder="所属企业"
        clearable
        style="width: 200px"
      >
        <el-option v-for="e in store.enterprises" :key="e.id" :label="e.name" :value="e.id" />
      </el-select>
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="draft">草稿</el-radio-button>
        <el-radio-button value="published">已发布</el-radio-button>
        <el-radio-button value="offline">已下架</el-radio-button>
        <el-radio-button value="closed">已关闭</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column v-if="isPlatform" label="类型" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="row.enterpriseId == null ? 'warning' : 'primary'">
            {{ row.ownerTypeLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        v-if="isPlatform"
        prop="enterpriseName"
        label="所属企业"
        width="120"
        show-overflow-tooltip
      />
      <el-table-column prop="name" label="课程名称" min-width="160" show-overflow-tooltip />
      <el-table-column label="关联资料" width="80" align="center">
        <template #default="{ row }">{{ row.materialCount }}</template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="row.statusTag">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'draft' || row.status === 'offline'"
            link
            type="primary"
            @click="openEdit(row)"
          >
            编辑
          </el-button>
          <el-button v-if="row.status === 'draft'" link type="success" @click="publish(row)">
            发布
          </el-button>
          <el-button v-if="row.status === 'published'" link type="warning" @click="offlineCourse(row)">
            下架
          </el-button>
          <el-button v-if="row.status === 'offline'" link type="success" @click="republishCourse(row)">
            重新上架
          </el-button>
          <el-button v-if="row.status === 'published'" link type="danger" @click="closeCourse(row)">
            关闭
          </el-button>
          <el-button link @click="viewProgress(row.id)">学习详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑课程' : '创建课程'" width="760px">
    <el-form label-width="120px">
      <el-form-item v-if="isPlatform" label="类型" required>
        <el-radio-group v-model="form.ownerType">
          <el-radio
            v-for="o in trainingOwnerTypeOptions"
            :key="o.value"
            :value="o.value"
          >
            {{ o.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="form.ownerType === 'enterprise'" label="所属企业" required>
        <el-select
          v-model="form.enterpriseId"
          style="width: 100%"
          :disabled="isEnterprise"
          placeholder="选择企业"
        >
          <el-option v-for="e in store.enterprises" :key="e.id" :label="e.name" :value="e.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="课程名称" required>
        <el-input v-model="form.name" placeholder="如：新入职安全合规必修课" />
      </el-form-item>
      <el-form-item label="课程简介">
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="课程目标及内容概述" />
      </el-form-item>
      <el-form-item label="关联资料" required>
        <el-select v-model="form.materialIds" multiple style="width: 100%" placeholder="按学习顺序选择">
          <el-option v-for="m in approvedMaterials" :key="m.id" :label="m.name" :value="m.id" />
        </el-select>
        <div class="field-hint">仅可选同类型（及同企业）资料；选择顺序即为学习顺序</div>
      </el-form-item>
      <el-form-item label="学习要求">
        <el-radio-group v-model="form.studyMode">
          <el-radio
            v-for="o in courseStudyModeOptions"
            :key="o.value"
            :value="o.value"
          >
            {{ o.label }}
          </el-radio>
        </el-radio-group>
        <div class="field-hint">必修的课程需要在该企业下抢班/排班/任务开始前完成。</div>
      </el-form-item>
      <el-form-item label="最低学习时长">
        <el-input-number
          v-model="form.minStudyMinutes"
          :min="0"
          placeholder="分钟"
          style="width: 220px"
        />
      </el-form-item>
      <el-form-item label="视频禁止拖拽">
        <el-switch v-model="form.videoNoSeek" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.field-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
</style>
