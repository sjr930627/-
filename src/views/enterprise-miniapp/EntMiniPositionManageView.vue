<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import type { EnterprisePosition, GrabInterviewPositionProfile } from '@/types'
import { generateId } from '@/utils'

const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const formOpen = ref(false)
const editingId = ref<string | null>(null)

function emptyProfile(): GrabInterviewPositionProfile {
  return {
    positionName: '',
    jobType: '',
    skills: [],
    requirements: '',
    description: '',
    ageMin: undefined,
    ageMax: undefined,
    gender: 'any',
    experience: '不限',
  }
}

const form = reactive({
  id: '',
  name: '',
  profile: emptyProfile(),
  skillsText: '',
})

const positions = computed(() => store.getEnterprisePositions(enterpriseId.value))

function openCreate() {
  editingId.value = null
  form.id = ''
  form.name = ''
  form.profile = emptyProfile()
  form.skillsText = ''
  formOpen.value = true
}

function openEdit(row: EnterprisePosition) {
  editingId.value = row.id
  form.id = row.id
  form.name = row.name
  form.profile = JSON.parse(JSON.stringify({ ...emptyProfile(), ...row.profile }))
  form.skillsText = (row.profile.skills ?? []).join('、')
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
}

function submit() {
  const positionName = (form.profile.positionName || form.name).trim()
  if (!positionName) {
    ElMessage.warning('请填写岗位名称')
    return
  }
  const skills = form.skillsText
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
  try {
    store.upsertEnterprisePosition(enterpriseId.value, {
      id: form.id || generateId('epos'),
      name: form.name.trim() || positionName,
      profile: {
        ...form.profile,
        positionName,
        skills,
        gender: form.profile.gender || 'any',
      },
      schedule: editingId.value
        ? store.getEnterprisePosition(editingId.value)?.schedule
        : undefined,
    })
    ElMessage.success(editingId.value ? '已更新' : '已创建')
    formOpen.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function removeRow(row: EnterprisePosition) {
  try {
    await ElMessageBox.confirm(`删除岗位「${row.profile.positionName || row.name}」？`, '提示', {
      type: 'warning',
    })
    store.removeEnterprisePosition(enterpriseId.value, row.id)
    ElMessage.success('已删除')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="岗位管理" back-to="/enterprise-miniapp/personnel" />

    <div class="toolbar">
      <p>企业级岗位模版，人员 / 抢班 / 面试统一引用</p>
      <button type="button" class="primary" @click="openCreate">新增岗位</button>
    </div>

    <div v-if="!positions.length" class="empty">暂无岗位，请先新增</div>

    <article v-for="row in positions" :key="row.id" class="card">
      <div class="main">
        <strong>{{ row.profile.positionName || row.name }}</strong>
        <p>
          <span v-if="row.profile.jobType">{{ row.profile.jobType }} · </span>
          {{ row.profile.requirements || row.profile.description || '暂无要求说明' }}
        </p>
        <div v-if="row.profile.skills?.length" class="tags">
          <em v-for="s in row.profile.skills" :key="s">{{ s }}</em>
        </div>
      </div>
      <div class="acts">
        <button type="button" @click="openEdit(row)">编辑</button>
        <button type="button" class="danger" @click="removeRow(row)">删除</button>
      </div>
    </article>

    <div v-if="formOpen" class="sheet-mask" @click.self="closeForm">
      <div class="sheet">
        <header>
          <strong>{{ editingId ? '编辑岗位' : '新增岗位' }}</strong>
          <button type="button" @click="closeForm">关闭</button>
        </header>
        <label>模版名称</label>
        <input v-model="form.name" placeholder="如：营业厅营业员模板">
        <label>岗位名称</label>
        <input v-model="form.profile.positionName" placeholder="人员与抢班展示名称">
        <label>岗位类型</label>
        <input v-model="form.profile.jobType" placeholder="如：零售服务">
        <label>技能（顿号分隔）</label>
        <input v-model="form.skillsText" placeholder="健康证、业务合规证">
        <label>任职要求</label>
        <textarea v-model="form.profile.requirements" rows="3" />
        <label>岗位描述</label>
        <textarea v-model="form.profile.description" rows="2" />
        <label>年龄范围</label>
        <div class="inline">
          <input v-model.number="form.profile.ageMin" type="number" placeholder="最小">
          <span>—</span>
          <input v-model.number="form.profile.ageMax" type="number" placeholder="最大">
        </div>
        <label>性别</label>
        <select v-model="form.profile.gender">
          <option value="any">不限</option>
          <option value="male">男</option>
          <option value="female">女</option>
        </select>
        <label>经验要求</label>
        <input v-model="form.profile.experience" placeholder="不限">
        <button type="button" class="primary save" @click="submit">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
}
.toolbar p {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
}
.primary {
  border: none;
  background: #228BFF;
  color: #fff;
  border-radius: 999px;
  height: 32px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}
.empty {
  padding: 40px 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.card {
  margin: 0 12px 8px;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  gap: 10px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
}
.main {
  flex: 1;
  min-width: 0;
}
.main strong {
  font-size: 15px;
  color: #111827;
}
.main p {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.45;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.tags em {
  font-style: normal;
  font-size: 11px;
  color: #228BFF;
  background: #D5E9FF;
  border-radius: 999px;
  padding: 2px 8px;
}
.acts {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.acts button {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 8px;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  color: #374151;
}
.acts .danger {
  color: #ef4444;
  border-color: #fecaca;
}
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 430px;
  max-height: 88vh;
  overflow: auto;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 14px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sheet header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.sheet header button {
  border: none;
  background: none;
  color: #6b7280;
}
.sheet label {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}
.sheet input,
.sheet textarea,
.sheet select {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
}
.inline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.inline input {
  flex: 1;
}
.save {
  margin-top: 12px;
  height: 42px;
  border-radius: 12px;
}
</style>
