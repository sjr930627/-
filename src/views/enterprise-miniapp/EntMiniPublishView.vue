<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import EntMiniJobStatsCard from '@/components/enterprise-miniapp/EntMiniJobStatsCard.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'

const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const enterprise = computed(() => store.enterprises.find((e) => e.id === enterpriseId.value))

const requirements = computed(() =>
  store.jobRequirements
    .filter((r) => r.enterpriseId === enterpriseId.value)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

const leads = computed(() =>
  store.recruitmentLeads.filter((l) => l.enterpriseId === enterpriseId.value),
)

const form = ref({
  title: '',
  department: '零售部',
  headcount: 5,
  salaryMin: 5000,
  salaryMax: 8000,
  location: '',
  description: '',
  requirements: '需持健康证；无犯罪记录',
  skills: '健康证',
})

function submit(publishNow: boolean) {
  const ent = enterprise.value
  if (!ent) {
    ElMessage.error('未找到企业信息')
    return
  }
  if (!form.value.title.trim() || !form.value.location.trim() || !form.value.description.trim()) {
    ElMessage.warning('请填写岗位名称、工作地点和岗位描述')
    return
  }
  const item = store.addJobRequirement({
    enterpriseId: ent.id,
    enterpriseName: ent.name,
    title: form.value.title.trim(),
    department: form.value.department.trim() || '未分配',
    departmentId: store.departments.find(
      (d) => d.enterpriseId === ent.id && d.name === form.value.department.trim(),
    )?.id,
    headcount: form.value.headcount,
    salaryMin: form.value.salaryMin,
    salaryMax: form.value.salaryMax,
    location: form.value.location.trim(),
    description: form.value.description.trim(),
    requirements: form.value.requirements.trim() || undefined,
    skills: form.value.skills
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean),
    employmentType: 'part_time',
    urgency: 'normal',
    interviewRounds: 1,
    status: 'pending',
  })
  if (publishNow) {
    store.publishJobRequirement(item.id)
    ElMessage.success('招聘需求已发布（招聘中）')
  } else {
    ElMessage.success('已保存为待开始')
  }
  router.replace('/enterprise-miniapp/recruitment')
}

function scrollToForm() {
  document.getElementById('publish-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="mini-page publish-page">
    <EntMiniNavBar title="发布招聘需求" back-to="/enterprise-miniapp/recruitment" />
    <div class="stats-wrap">
      <EntMiniJobStatsCard
        :jobs="requirements"
        :leads="leads"
        @publish="scrollToForm"
      />
    </div>
    <div id="publish-form" class="form">
      <label>岗位名称</label>
      <input v-model="form.title" placeholder="如：营业厅营业员">
      <label>部门</label>
      <input v-model="form.department">
      <label>需求人数</label>
      <input v-model.number="form.headcount" type="number" min="1">
      <label>薪资范围（元）</label>
      <div class="inline">
        <input v-model.number="form.salaryMin" type="number">
        <span>-</span>
        <input v-model.number="form.salaryMax" type="number">
      </div>
      <label>工作地点</label>
      <input v-model="form.location" placeholder="城市/区域">
      <label>岗位描述</label>
      <textarea v-model="form.description" rows="3" />
      <label>任职要求</label>
      <textarea v-model="form.requirements" rows="2" />
      <label>技能标签（逗号分隔）</label>
      <input v-model="form.skills">
      <div class="actions">
        <button type="button" class="ghost" @click="submit(false)">保存待开始</button>
        <button type="button" class="mini-btn-primary" @click="submit(true)">立即发布</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.publish-page {
  background: #fff;
}
.stats-wrap {
  background: #fff;
  padding: 12px 12px 4px;
}
.form {
  padding: 8px 16px 28px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form label {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
}
.form input,
.form textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  background: #fff;
}
.inline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.inline input {
  flex: 1;
}
.actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
.ghost,
.mini-btn-primary {
  flex: 1;
  height: 42px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
}
.ghost {
  border: 1px solid #c7c3f5;
  background: #fff;
  color: #228BFF;
}
.mini-btn-primary {
  border: none;
  background: linear-gradient(90deg, #5AA8FF, #228BFF);
  color: #fff;
}
</style>
