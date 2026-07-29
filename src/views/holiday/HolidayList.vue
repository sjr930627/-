<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import type { Holiday } from '@/types'

const store = useAppStore()
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const filterYear = ref('2026')

const form = ref({
  name: '',
  date: '',
  type: 'custom' as 'legal' | 'custom',
  isWorkday: false,
})

const tableData = computed(() =>
  store.holidays
    .filter((h) => h.date.startsWith(filterYear.value))
    .sort((a, b) => a.date.localeCompare(b.date)),
)

function openCreate() {
  editingId.value = null
  form.value = { name: '', date: '', type: 'custom', isWorkday: false }
  dialogVisible.value = true
}

function openEdit(holiday: Holiday) {
  editingId.value = holiday.id
  form.value = {
    name: holiday.name,
    date: holiday.date,
    type: holiday.type,
    isWorkday: holiday.isWorkday,
  }
  dialogVisible.value = true
}

function submit() {
  if (!form.value.name.trim() || !form.value.date) {
    ElMessage.warning('请填写假日名称和日期')
    return
  }
  if (editingId.value) {
    store.updateHoliday(editingId.value, form.value)
    ElMessage.success('更新成功')
  } else {
    store.addHoliday(form.value)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
}

async function remove(holiday: Holiday) {
  await ElMessageBox.confirm(`确定删除「${holiday.name}」？`, '提示', { type: 'warning' })
  store.removeHoliday(holiday.id)
  ElMessage.success('删除成功')
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">假日管理</h2>
        <p class="text-muted">管理法定节假日与自定义休息日/调休工作日</p>
      </div>
      <el-space>
        <el-select v-model="filterYear" style="width: 100px">
          <el-option label="2026" value="2026" />
          <el-option label="2025" value="2025" />
        </el-select>
        <el-button type="primary" @click="openCreate">新增假日</el-button>
      </el-space>
    </div>

    <el-alert
      title="周末规则在「排班规则」中配置。法定假日可手动维护，后续可对接国务院放假安排自动同步。"
      type="info"
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-table :data="tableData" border stripe>
      <el-table-column prop="date" label="日期" width="120" />
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.type === 'legal' ? 'danger' : 'primary'" size="small">
            {{ row.type === 'legal' ? '法定' : '自定义' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="属性" width="120">
        <template #default="{ row }">
          <el-tag :type="row.isWorkday ? 'warning' : 'success'" size="small">
            {{ row.isWorkday ? '调休上班' : '休息' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑假日' : '新增假日'" width="480px">
      <el-form label-width="90px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio value="legal">法定假日</el-radio>
            <el-radio value="custom">自定义</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="日期属性">
          <el-radio-group v-model="form.isWorkday">
            <el-radio :value="false">休息日</el-radio>
            <el-radio :value="true">调休工作日</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
