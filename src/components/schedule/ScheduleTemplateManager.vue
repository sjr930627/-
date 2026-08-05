<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import type { ScheduleTemplate } from '@/types'

const props = defineProps<{
  visible: boolean
  teamId: string
  attendanceGroupId: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  apply: [templateId: string]
}>()

const store = useAppStore()
const formVisible = ref(false)
const editingId = ref<string | null>(null)
const form = ref({
  name: '',
  pattern: [] as string[],
  isDefault: false,
})

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const teamTemplates = computed(() =>
  store.scheduleTemplates.filter((t) => t.teamId === props.teamId),
)

const weekLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

watch(
  () => props.visible,
  (open) => {
    if (!open) {
      formVisible.value = false
      editingId.value = null
    }
  },
)

function shiftName(id: string) {
  return store.shifts.find((s) => s.id === id)?.name ?? id
}

function openCreate() {
  editingId.value = null
  const workShifts = store.shifts.filter((s) => s.code !== 'REST').map((s) => s.id)
  const rest = store.shifts.find((s) => s.code === 'REST')?.id ?? 'shift_rest'
  form.value = {
    name: '',
    pattern: [...workShifts, rest, rest, rest].slice(0, 7),
    isDefault: !teamTemplates.value.length,
  }
  while (form.value.pattern.length < 7) form.value.pattern.push(rest)
  formVisible.value = true
}

function openEdit(row: ScheduleTemplate) {
  editingId.value = row.id
  form.value = {
    name: row.name,
    pattern: [...row.pattern],
    isDefault: Boolean(row.isDefault),
  }
  formVisible.value = true
}

function saveTemplate() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写模板名称')
    return
  }
  while (form.value.pattern.length < 7) {
    form.value.pattern.push('shift_rest')
  }
  const pattern = form.value.pattern.slice(0, 7)
  if (editingId.value) {
    const item = store.scheduleTemplates.find((t) => t.id === editingId.value)
    if (item) {
      item.name = form.value.name.trim()
      item.pattern = pattern
      item.isDefault = form.value.isDefault
      if (form.value.isDefault) {
        store.scheduleTemplates.forEach((t) => {
          if (t.teamId === props.teamId && t.id !== item.id) t.isDefault = false
        })
      }
      store.persist('scheduleTemplates')
      ElMessage.success('模板已更新')
    }
  } else {
    store.saveScheduleTemplate({
      name: form.value.name.trim(),
      teamId: props.teamId,
      attendanceGroupId: props.attendanceGroupId,
      pattern,
      isDefault: form.value.isDefault,
    })
    ElMessage.success('模板已创建')
  }
  formVisible.value = false
}

async function removeTemplate(row: ScheduleTemplate) {
  await ElMessageBox.confirm(`确定删除模板「${row.name}」？`, '提示', { type: 'warning' })
  store.deleteScheduleTemplate(row.id)
  ElMessage.success('已删除')
}

function applyTemplate(id: string) {
  emit('apply', id)
}
</script>

<template>
  <el-dialog v-model="dialogVisible" title="排班模版管理" width="760px">
    <div class="toolbar">
      <el-button type="primary" @click="openCreate">+ 新建模版</el-button>
    </div>
    <el-table :data="teamTemplates" border stripe size="small">
      <el-table-column prop="name" label="模版名称" min-width="140" />
      <el-table-column label="周期模式" min-width="280">
        <template #default="{ row }">
          <el-tag v-for="(sid, idx) in row.pattern" :key="idx" size="small" class="pattern-tag">
            {{ weekLabels[idx] }}: {{ shiftName(sid) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="默认" width="70" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.isDefault" size="small" type="success">默认</el-tag>
          <span v-else class="text-muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="applyTemplate(row.id)">套用</el-button>
          <el-button link @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="removeTemplate(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!teamTemplates.length" description="暂无排班模版" />

    <el-dialog v-model="formVisible" :title="editingId ? '编辑模版' : '新建模版'" width="520px" append-to-body>
      <el-form label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：标准三班倒" maxlength="30" />
        </el-form-item>
        <el-form-item label="周期">
          <div class="pattern-grid">
            <div v-for="(label, idx) in weekLabels" :key="idx" class="pattern-row">
              <span class="pattern-label">{{ label }}</span>
              <el-select v-model="form.pattern[idx]" style="width: 140px">
                <el-option v-for="s in store.shifts" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="默认模版">
          <el-switch v-model="form.isDefault" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate">保存</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<style scoped>
.toolbar {
  margin-bottom: 12px;
}

.pattern-tag {
  margin: 0 4px 4px 0;
}

.pattern-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pattern-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pattern-label {
  width: 36px;
  font-size: 13px;
  color: #64748b;
}
</style>
