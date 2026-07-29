<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { getDepartmentName } from '@/utils'
import type { Team } from '@/types'

const store = useAppStore()
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const form = ref({
  name: '',
  departmentId: '',
  memberIds: [] as string[],
  hourlyRate: undefined as number | undefined,
  description: '',
})

const tableData = computed(() =>
  store.teams.map((t) => ({
    ...t,
    departmentName: getDepartmentName(store.departments, t.departmentId),
    memberNames: t.memberIds
      .map((id) => store.employees.find((e) => e.id === id)?.name)
      .filter(Boolean)
      .join('、'),
    hourlyRateLabel:
      t.hourlyRate != null ? `¥${t.hourlyRate}/h` : `默认 ¥${store.payrollConfig.defaultHourlyRate}/h`,
  })),
)

const activeEmployees = computed(() => store.activeEmployees)

function openCreate() {
  editingId.value = null
  form.value = {
    name: '',
    departmentId: store.departments[0]?.id ?? '',
    memberIds: [],
    hourlyRate: undefined,
    description: '',
  }
  dialogVisible.value = true
}

function openEdit(team: Team) {
  editingId.value = team.id
  form.value = {
    name: team.name,
    departmentId: team.departmentId,
    memberIds: [...team.memberIds],
    hourlyRate: team.hourlyRate,
    description: team.description ?? '',
  }
  dialogVisible.value = true
}

function submit() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入考勤组名称')
    return
  }
  if (!form.value.departmentId) {
    ElMessage.warning('请选择所属部门')
    return
  }
  const payload = {
    ...form.value,
    hourlyRate: form.value.hourlyRate === undefined || form.value.hourlyRate === null
      ? undefined
      : form.value.hourlyRate,
  }
  if (editingId.value) {
    store.updateTeam(editingId.value, payload)
    ElMessage.success('更新成功')
  } else {
    store.addTeam(payload)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
}

async function remove(team: Team) {
  await ElMessageBox.confirm(`确定删除考勤组「${team.name}」？`, '提示', { type: 'warning' })
  store.removeTeam(team.id)
  ElMessage.success('删除成功')
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">考勤组管理</h2>
        <p class="text-muted">排班与考勤单元，组内成员共用统一时薪（未设置则用薪酬默认时薪）</p>
      </div>
      <el-button type="primary" @click="openCreate">新增考勤组</el-button>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="考勤组" min-width="140" />
      <el-table-column prop="departmentName" label="所属部门" min-width="120" />
      <el-table-column prop="hourlyRateLabel" label="组时薪" width="120" />
      <el-table-column prop="memberNames" label="成员" min-width="220" show-overflow-tooltip />
      <el-table-column prop="description" label="说明" min-width="140" show-overflow-tooltip />
      <el-table-column label="人数" width="70">
        <template #default="{ row }">{{ row.memberIds.length }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑考勤组' : '新增考勤组'" width="520px">
      <el-form label-width="100px">
        <el-form-item label="考勤组名称" required>
          <el-input v-model="form.name" placeholder="如：一车间早班组" />
        </el-form-item>
        <el-form-item label="所属部门" required>
          <el-select v-model="form.departmentId" style="width: 100%">
            <el-option v-for="d in store.departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="组时薪">
          <el-input-number
            v-model="form.hourlyRate"
            :min="1"
            :precision="0"
            placeholder="留空用默认"
            controls-position="right"
            style="width: 160px"
          />
          <span class="text-muted" style="margin-left: 8px">
            元/h · 默认 ¥{{ store.payrollConfig.defaultHourlyRate }}
          </span>
        </el-form-item>
        <el-form-item label="组成员">
          <el-select v-model="form.memberIds" multiple filterable style="width: 100%">
            <el-option
              v-for="e in activeEmployees"
              :key="e.id"
              :label="`${e.name} (${e.employeeNo})`"
              :value="e.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
