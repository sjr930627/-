<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { talentStatusMap } from '@/constants/recruitment'
import type { Talent } from '@/types'

const store = useAppStore()
const route = useRoute()

const keyword = ref('')
const statusFilter = ref<'all' | Talent['status']>('all')
const dialogVisible = ref(false)
const assignDialog = ref(false)
const selectedTalentId = ref('')
const assignRequirementId = ref('')

watch(
  () => route.query.q,
  (q) => {
    if (typeof q === 'string') keyword.value = q
  },
  { immediate: true },
)

const tableData = computed(() =>
  store.talents
    .filter((t) => {
      if (statusFilter.value !== 'all' && t.status !== statusFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim()
      return (
        t.name.includes(kw) ||
        t.phone.includes(kw) ||
        t.skills.some((s) => s.includes(kw))
      )
    })
    .map((t) => ({
      ...t,
      statusLabel: talentStatusMap[t.status],
      skillsLabel: t.skills.join('、'),
    })),
)

const form = ref({
  name: '',
  phone: '',
  gender: 'female' as 'male' | 'female',
  age: 25,
  education: '本科',
  experience: '',
  skills: '',
  expectedSalary: '',
  source: '',
})

function openCreate() {
  form.value = {
    name: '',
    phone: '',
    gender: 'female',
    age: 25,
    education: '本科',
    experience: '',
    skills: '',
    expectedSalary: '',
    source: '',
  }
  dialogVisible.value = true
}

function submit() {
  if (!form.value.name.trim() || !form.value.phone.trim()) {
    ElMessage.warning('请填写姓名和手机号')
    return
  }
  store.addTalent({
    name: form.value.name.trim(),
    phone: form.value.phone.trim(),
    gender: form.value.gender,
    age: form.value.age,
    education: form.value.education,
    experience: form.value.experience.trim(),
    skills: form.value.skills.split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
    expectedSalary: form.value.expectedSalary.trim() || undefined,
    source: form.value.source.trim() || '手动录入',
    status: 'available',
  })
  ElMessage.success('已加入人才库')
  dialogVisible.value = false
}

function openAssign(row: Talent) {
  selectedTalentId.value = row.id
  assignRequirementId.value =
    store.jobRequirements.find((r) => r.status === 'recruiting')?.id ?? ''
  assignDialog.value = true
}

function submitAssign() {
  if (!assignRequirementId.value) {
    ElMessage.warning('请选择岗位')
    return
  }
  try {
    store.createLeadFromTalent(selectedTalentId.value, assignRequirementId.value)
    ElMessage.success('已创建跟进线索（待筛选）')
    assignDialog.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function archive(row: Talent) {
  await ElMessageBox.confirm(`归档人才「${row.name}」？`, '提示')
  store.updateTalent(row.id, { status: 'archived' })
  ElMessage.success('已归档')
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">人才库</h2>
        <p class="text-muted">沉淀候选人资源，可快速关联岗位创建跟进线索</p>
      </div>
      <el-button type="primary" @click="openCreate">新增人才</el-button>
    </div>

    <div class="page-toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索姓名、手机、技能"
        clearable
        prefix-icon="Search"
        style="width: 260px"
      />
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="available">可联系</el-radio-button>
        <el-radio-button value="in_process">跟进中</el-radio-button>
        <el-radio-button value="hired">已录用</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="姓名" width="90" />
      <el-table-column prop="phone" label="手机号" width="120" />
      <el-table-column label="性别/年龄" width="90">
        <template #default="{ row }">
          {{ row.gender === 'male' ? '男' : '女' }} / {{ row.age ?? '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="education" label="学历" width="80" />
      <el-table-column prop="experience" label="工作经验" min-width="160" show-overflow-tooltip />
      <el-table-column prop="skillsLabel" label="技能标签" min-width="140" show-overflow-tooltip />
      <el-table-column prop="expectedSalary" label="期望薪资" width="90" />
      <el-table-column prop="source" label="来源" width="100" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="
              row.status === 'available'
                ? 'success'
                : row.status === 'in_process'
                  ? 'warning'
                  : 'info'
            "
          >
            {{ row.statusLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'available'"
            link
            type="primary"
            @click="openAssign(row)"
          >
            关联岗位
          </el-button>
          <el-button
            v-if="row.status !== 'archived'"
            link
            type="danger"
            @click="archive(row)"
          >
            归档
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" title="新增人才" width="520px">
    <el-form label-width="90px">
      <el-form-item label="姓名" required>
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="手机号" required>
        <el-input v-model="form.phone" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="性别">
            <el-radio-group v-model="form.gender">
              <el-radio value="female">女</el-radio>
              <el-radio value="male">男</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="年龄">
            <el-input-number v-model="form.age" :min="18" :max="60" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="学历">
        <el-select v-model="form.education" style="width: 100%">
          <el-option label="高中" value="高中" />
          <el-option label="大专" value="大专" />
          <el-option label="本科" value="本科" />
          <el-option label="硕士" value="硕士" />
        </el-select>
      </el-form-item>
      <el-form-item label="工作经验">
        <el-input v-model="form.experience" />
      </el-form-item>
      <el-form-item label="技能标签">
        <el-input v-model="form.skills" placeholder="逗号分隔" />
      </el-form-item>
      <el-form-item label="期望薪资">
        <el-input v-model="form.expectedSalary" placeholder="如 6K-8K" />
      </el-form-item>
      <el-form-item label="来源">
        <el-input v-model="form.source" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="assignDialog" title="关联岗位创建线索" width="480px">
    <el-form label-width="80px">
      <el-form-item label="选择岗位">
        <el-select v-model="assignRequirementId" style="width: 100%">
          <el-option
            v-for="r in store.jobRequirements.filter((x) => x.status === 'recruiting')"
            :key="r.id"
            :label="`${r.enterpriseName} - ${r.title}`"
            :value="r.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="assignDialog = false">取消</el-button>
      <el-button type="primary" @click="submitAssign">创建线索</el-button>
    </template>
  </el-dialog>
</template>
