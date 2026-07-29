<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { buildDepartmentTree, getDepartmentName } from '@/utils'
import type { Department } from '@/types'

const store = useAppStore()
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const form = ref({
  name: '',
  parentId: null as string | null,
  sort: 0,
})

const treeData = computed(() => buildDepartmentTree(store.departments))

const parentOptions = computed(() =>
  store.departments.filter((d) => d.id !== editingId.value),
)

function openCreate(parentId: string | null = null) {
  editingId.value = null
  form.value = { name: '', parentId, sort: 0 }
  dialogVisible.value = true
}

function openEdit(dept: Department) {
  editingId.value = dept.id
  form.value = { name: dept.name, parentId: dept.parentId, sort: dept.sort }
  dialogVisible.value = true
}

function submit() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入部门名称')
    return
  }
  try {
    if (editingId.value) {
      store.updateDepartment(editingId.value, form.value)
      ElMessage.success('更新成功')
    } else {
      store.addDepartment(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function remove(dept: Department) {
  try {
    await ElMessageBox.confirm(`确定删除部门「${dept.name}」？`, '提示', { type: 'warning' })
    store.removeDepartment(dept.id)
    ElMessage.success('删除成功')
  } catch (e) {
    if ((e as string) !== 'cancel') ElMessage.error((e as Error).message)
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">部门管理</h2>
        <p class="text-muted">树形结构展示企业部门层级</p>
      </div>
      <el-button type="primary" @click="openCreate()">新增部门</el-button>
    </div>

    <el-table :data="treeData" row-key="id" default-expand-all border>
      <el-table-column prop="name" label="部门名称" min-width="200" />
      <el-table-column label="上级部门" min-width="160">
        <template #default="{ row }">
          {{ row.parentId ? getDepartmentName(store.departments, row.parentId) : '—' }}
        </template>
      </el-table-column>
      <el-table-column prop="sort" label="排序" width="80" />
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openCreate(row.id)">添加子部门</el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑部门' : '新增部门'" width="480px">
      <el-form label-width="90px">
        <el-form-item label="部门名称" required>
          <el-input v-model="form.name" placeholder="请输入部门名称" />
        </el-form-item>
        <el-form-item label="上级部门">
          <el-select v-model="form.parentId" clearable placeholder="无（顶级部门）" style="width: 100%">
            <el-option
              v-for="d in parentOptions"
              :key="d.id"
              :label="d.name"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
