<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { formatSalaryRange, jobRequirementStatusMap } from '@/constants/recruitment'
import type { JobRequirement } from '@/types'

const store = useAppStore()
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const enterpriseFilter = ref('')
const statusFilter = ref<'all' | JobRequirement['status']>('all')

const form = ref({
  enterpriseId: '',
  title: '',
  department: '',
  headcount: 5,
  salaryMin: 4000,
  salaryMax: 8000,
  location: '',
  description: '',
})

const tableData = computed(() =>
  store.jobRequirements
    .filter((r) => {
      if (enterpriseFilter.value && r.enterpriseId !== enterpriseFilter.value) return false
      if (statusFilter.value !== 'all' && r.status !== statusFilter.value) return false
      return true
    })
    .map((r) => ({
      ...r,
      statusLabel: jobRequirementStatusMap[r.status],
      salaryLabel: formatSalaryRange(r.salaryMin, r.salaryMax),
      progressLabel: `${r.filledCount}/${r.headcount}`,
    })),
)

function openCreate() {
  editingId.value = null
  form.value = {
    enterpriseId: store.enterprises[0]?.id ?? '',
    title: '',
    department: '',
    headcount: 5,
    salaryMin: 4000,
    salaryMax: 8000,
    location: '',
    description: '',
  }
  dialogVisible.value = true
}

function openEdit(row: JobRequirement) {
  if (row.status === 'closed') {
    ElMessage.warning('已关闭需求不可编辑')
    return
  }
  editingId.value = row.id
  form.value = {
    enterpriseId: row.enterpriseId,
    title: row.title,
    department: row.department,
    headcount: row.headcount,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    location: row.location,
    description: row.description,
  }
  dialogVisible.value = true
}

function submit() {
  if (!form.value.title.trim() || !form.value.enterpriseId) {
    ElMessage.warning('请填写完整信息')
    return
  }
  const ent = store.enterprises.find((e) => e.id === form.value.enterpriseId)
  if (!ent) return

  const payload = {
    enterpriseId: ent.id,
    enterpriseName: ent.name,
    title: form.value.title.trim(),
    department: form.value.department.trim() || '未分配',
    headcount: form.value.headcount,
    salaryMin: form.value.salaryMin,
    salaryMax: form.value.salaryMax,
    location: form.value.location.trim(),
    description: form.value.description.trim(),
    status: 'draft' as const,
  }

  if (editingId.value) {
    store.updateJobRequirement(editingId.value, payload)
    ElMessage.success('更新成功')
  } else {
    store.addJobRequirement(payload)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
}

async function publish(row: JobRequirement) {
  await ElMessageBox.confirm(`发布岗位「${row.title}」？`, '发布确认')
  store.publishJobRequirement(row.id)
  ElMessage.success('已发布，可开始录入跟进线索')
}

async function closeReq(row: JobRequirement) {
  await ElMessageBox.confirm(`关闭岗位「${row.title}」？`, '提示', { type: 'warning' })
  store.closeJobRequirement(row.id)
  ElMessage.success('已关闭')
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">需求管理</h2>
        <p class="text-muted">选择企业发布岗位需求，作为招聘跟进线索的关联基础</p>
      </div>
      <el-button type="primary" @click="openCreate">发布岗位需求</el-button>
    </div>

    <div class="page-toolbar">
      <el-select v-model="enterpriseFilter" placeholder="选择企业" clearable style="width: 220px">
        <el-option
          v-for="e in store.enterprises"
          :key="e.id"
          :label="e.name"
          :value="e.id"
        />
      </el-select>
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="active">招聘中</el-radio-button>
        <el-radio-button value="draft">草稿</el-radio-button>
        <el-radio-button value="closed">已关闭</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="enterpriseName" label="企业" min-width="160" />
      <el-table-column prop="title" label="岗位名称" min-width="140" />
      <el-table-column prop="department" label="部门" width="100" />
      <el-table-column prop="salaryLabel" label="薪资范围" width="100" />
      <el-table-column prop="location" label="工作地点" min-width="120" />
      <el-table-column label="招聘进度" width="100" align="center">
        <template #default="{ row }">
          <span>{{ row.progressLabel }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="row.status === 'active' ? 'success' : row.status === 'draft' ? 'info' : 'danger'"
          >
            {{ row.statusLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status !== 'closed'" link type="primary" @click="openEdit(row)">
            编辑
          </el-button>
          <el-button v-if="row.status === 'draft'" link type="success" @click="publish(row)">
            发布
          </el-button>
          <el-button v-if="row.status === 'active'" link type="warning" @click="closeReq(row)">
            关闭
          </el-button>
          <el-button
            link
            @click="$router.push({ path: '/recruitment/progress', query: { req: row.id } })"
          >
            查看线索
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑岗位需求' : '发布岗位需求'" width="640px">
    <el-form label-width="100px">
      <el-form-item label="所属企业" required>
        <el-select v-model="form.enterpriseId" style="width: 100%">
          <el-option v-for="e in store.enterprises" :key="e.id" :label="e.name" :value="e.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="岗位名称" required>
        <el-input v-model="form.title" placeholder="如：5G套餐推广专员" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="所属部门">
            <el-input v-model="form.department" placeholder="市场部" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="招聘人数">
            <el-input-number v-model="form.headcount" :min="1" :max="999" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="薪资范围">
        <el-input-number v-model="form.salaryMin" :min="1000" :step="500" /> —
        <el-input-number v-model="form.salaryMax" :min="form.salaryMin" :step="500" /> 元/月
      </el-form-item>
      <el-form-item label="工作地点">
        <el-input v-model="form.location" placeholder="北京市朝阳区" />
      </el-form-item>
      <el-form-item label="岗位描述">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>
