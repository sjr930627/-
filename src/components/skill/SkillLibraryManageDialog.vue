<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { SKILL_LIBRARY_CATEGORIES } from '@/constants/skillLibrary'
import type { SkillLibraryItem } from '@/types'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const store = useAppStore()

const open = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const editingId = ref<string | null>(null)
const form = ref({
  name: '',
  category: SKILL_LIBRARY_CATEGORIES[1] as string,
  icon: '📌',
})

const rows = computed(() =>
  [...store.skillLibrary].sort(
    (a, b) =>
      (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name, 'zh-CN'),
  ),
)

watch(
  () => props.visible,
  (v) => {
    if (v) resetForm()
  },
)

function resetForm() {
  editingId.value = null
  form.value = {
    name: '',
    category: SKILL_LIBRARY_CATEGORIES[1],
    icon: '📌',
  }
}

function startEdit(row: SkillLibraryItem) {
  editingId.value = row.id
  form.value = {
    name: row.name,
    category: row.category,
    icon: row.icon || '📌',
  }
}

function submit() {
  const name = form.value.name.trim()
  if (!name) {
    ElMessage.warning('请填写技能名称')
    return
  }
  try {
    if (editingId.value) {
      store.updateSkillLibraryItem(editingId.value, {
        name,
        category: form.value.category.trim() || '其他',
        icon: form.value.icon.trim() || '📌',
      })
      ElMessage.success('技能已更新')
    } else {
      store.addSkillLibraryItem({
        name,
        category: form.value.category.trim() || '其他',
        icon: form.value.icon.trim() || '📌',
      })
      ElMessage.success('技能已添加')
    }
    resetForm()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function removeItem(row: SkillLibraryItem) {
  try {
    await ElMessageBox.confirm(`确定删除技能「${row.name}」？`, '提示', { type: 'warning' })
    store.removeSkillLibraryItem(row.id)
    if (editingId.value === row.id) resetForm()
    ElMessage.success('已删除')
  } catch {
    /* cancelled */
  }
}

function toggleEnabled(row: SkillLibraryItem) {
  store.updateSkillLibraryItem(row.id, { enabled: row.enabled === false })
}
</script>

<template>
  <el-dialog v-model="open" title="维护技能库" width="640px" destroy-on-close append-to-body>
    <p class="hint">技能库与招聘要求、灵工档案技能证书同源，修改后各端同步生效。</p>

    <el-form label-width="80px" class="edit-form" @submit.prevent="submit">
      <el-row :gutter="12">
        <el-col :span="10">
          <el-form-item label="技能名称" required>
            <el-input v-model="form.name" maxlength="32" placeholder="如：健康证" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="分类">
            <el-select v-model="form.category" filterable allow-create default-first-option style="width: 100%">
              <el-option v-for="c in SKILL_LIBRARY_CATEGORIES" :key="c" :label="c" :value="c" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="图标">
            <el-input v-model="form.icon" maxlength="4" />
          </el-form-item>
        </el-col>
      </el-row>
      <div class="form-actions">
        <el-button v-if="editingId" @click="resetForm">取消编辑</el-button>
        <el-button type="primary" @click="submit">
          {{ editingId ? '保存修改' : '新增技能' }}
        </el-button>
      </div>
    </el-form>

    <el-table :data="rows" border stripe size="small" max-height="360">
      <el-table-column label="图标" width="60" align="center">
        <template #default="{ row }">{{ row.icon || '📌' }}</template>
      </el-table-column>
      <el-table-column prop="name" label="技能名称" min-width="140" />
      <el-table-column prop="category" label="分类" min-width="120" show-overflow-tooltip />
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.enabled === false ? 'info' : 'success'" size="small">
            {{ row.enabled === false ? '停用' : '启用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="startEdit(row)">编辑</el-button>
          <el-button link type="primary" @click="toggleEnabled(row)">
            {{ row.enabled === false ? '启用' : '停用' }}
          </el-button>
          <el-button link type="danger" @click="removeItem(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<style scoped>
.hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: #909399;
}
.edit-form {
  margin-bottom: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
