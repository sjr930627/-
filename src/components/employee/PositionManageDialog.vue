<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import type { EnterprisePosition, GrabInterviewPositionProfile } from '@/types'
import { generateId } from '@/utils'

const props = defineProps<{
  visible: boolean
  enterpriseId: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const store = useAppStore()
const editingId = ref<string | null>(null)
const formVisible = ref(false)

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

const positions = computed(() => store.getEnterprisePositions(props.enterpriseId))

watch(
  () => props.visible,
  (open) => {
    if (!open) {
      formVisible.value = false
      editingId.value = null
    }
  },
)

function close() {
  emit('update:visible', false)
}

function openCreate() {
  editingId.value = null
  form.id = ''
  form.name = ''
  form.profile = emptyProfile()
  form.skillsText = ''
  formVisible.value = true
}

function openEdit(row: EnterprisePosition) {
  editingId.value = row.id
  form.id = row.id
  form.name = row.name
  form.profile = {
    ...emptyProfile(),
    ...JSON.parse(JSON.stringify(row.profile)),
  }
  form.skillsText = (row.profile.skills ?? []).join('、')
  formVisible.value = true
}

function cancelForm() {
  formVisible.value = false
  editingId.value = null
}

function submitForm() {
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
    store.upsertEnterprisePosition(props.enterpriseId, {
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
    ElMessage.success(editingId.value ? '岗位已更新' : '岗位已创建')
    formVisible.value = false
    editingId.value = null
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function removeRow(row: EnterprisePosition) {
  try {
    await ElMessageBox.confirm(`确认删除岗位「${row.profile.positionName || row.name}」？`, '删除岗位', {
      type: 'warning',
    })
    store.removeEnterprisePosition(props.enterpriseId, row.id)
    ElMessage.success('已删除')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}

function skillsSummary(row: EnterprisePosition) {
  const skills = row.profile.skills ?? []
  if (!skills.length) return '—'
  return skills.slice(0, 3).join('、') + (skills.length > 3 ? '…' : '')
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    title="岗位管理"
    size="560px"
    destroy-on-close
    @close="close"
  >
    <div class="toolbar">
      <span class="hint">企业级岗位模版，任意部门人员 / 抢班 / 面试均可引用</span>
      <el-button type="primary" @click="openCreate">新增岗位</el-button>
    </div>

    <el-table :data="positions" size="small" stripe empty-text="暂无岗位，请先新增">
      <el-table-column label="岗位名称" min-width="120">
        <template #default="{ row }">
          <div class="name">{{ row.profile.positionName || row.name }}</div>
          <div v-if="row.name && row.name !== row.profile.positionName" class="sub">{{ row.name }}</div>
        </template>
      </el-table-column>
      <el-table-column label="类型" prop="profile.jobType" width="90" show-overflow-tooltip>
        <template #default="{ row }">{{ row.profile.jobType || '—' }}</template>
      </el-table-column>
      <el-table-column label="技能" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ skillsSummary(row) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="removeRow(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer
      v-model="formVisible"
      :title="editingId ? '编辑岗位' : '新增岗位'"
      size="480px"
      append-to-body
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="模版名称" required>
          <el-input v-model="form.name" placeholder="如：营业厅营业员模板" />
        </el-form-item>
        <el-form-item label="岗位名称" required>
          <el-input v-model="form.profile.positionName" placeholder="人员与抢班展示用名称" />
        </el-form-item>
        <el-form-item label="岗位类型">
          <el-input v-model="form.profile.jobType" placeholder="如：零售服务" />
        </el-form-item>
        <el-form-item label="技能要求">
          <el-input v-model="form.skillsText" placeholder="多个技能用顿号/逗号分隔" />
        </el-form-item>
        <el-form-item label="任职要求">
          <el-input v-model="form.profile.requirements" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="岗位描述">
          <el-input v-model="form.profile.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="年龄范围">
          <div class="inline">
            <el-input-number v-model="form.profile.ageMin" :min="16" :max="70" controls-position="right" />
            <span>—</span>
            <el-input-number v-model="form.profile.ageMax" :min="16" :max="70" controls-position="right" />
          </div>
        </el-form-item>
        <el-form-item label="性别要求">
          <el-radio-group v-model="form.profile.gender">
            <el-radio value="any">不限</el-radio>
            <el-radio value="male">男</el-radio>
            <el-radio value="female">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="经验要求">
          <el-input v-model="form.profile.experience" placeholder="如：不限 / 1年以上" />
        </el-form-item>
      </el-form>
      <div class="form-actions">
        <el-button @click="cancelForm">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </div>
    </el-drawer>
  </el-drawer>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.hint {
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}
.name {
  font-weight: 600;
  color: #111827;
}
.sub {
  margin-top: 2px;
  font-size: 11px;
  color: #94a3b8;
}
.inline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
