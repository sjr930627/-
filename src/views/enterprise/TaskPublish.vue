<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { dispatchModeMap, taskPublishStatusMap } from '@/constants/task'
import type { Task } from '@/types'

const store = useAppStore()
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const form = ref({
  name: '',
  taskTypeId: '',
  plannedTotal: undefined as number | undefined,
  dateRange: [] as string[],
  dispatchMode: 'hall' as 'assign' | 'hall',
  assigneeIds: [] as string[],
  maxPerPerson: 5,
  region: '',
  description: '',
})

const enterpriseId = computed(() => store.currentEnterpriseId)

const publishedTypes = computed(() =>
  store.taskTypes.filter((t) => t.enterpriseId === enterpriseId.value && t.status === 'published'),
)

const workerOptions = computed(() =>
  store.activeEmployees.map((e) => ({ label: `${e.name}（${e.employeeNo}）`, value: e.id })),
)

const tableData = computed(() =>
  store.tasks
    .filter((t) => t.enterpriseId === enterpriseId.value)
    .map((t) => ({
      ...t,
      statusLabel: taskPublishStatusMap[t.status],
      dispatchLabel: dispatchModeMap[t.dispatchMode],
    })),
)

function resetForm() {
  const typeId = publishedTypes.value[0]?.id ?? ''
  form.value = {
    name: typeId ? store.suggestTaskName(typeId) : '',
    taskTypeId: typeId,
    plannedTotal: undefined,
    dateRange: ['2026-07-26', '2026-08-26'],
    dispatchMode: 'hall',
    assigneeIds: [],
    maxPerPerson: 5,
    region: '',
    description: '',
  }
}

watch(
  () => form.value.taskTypeId,
  (id) => {
    if (id && !editingId.value) {
      form.value.name = store.suggestTaskName(id)
    }
  },
)

function openCreate() {
  if (!publishedTypes.value.length) {
    ElMessage.warning('请先创建并审批通过至少一个任务类型')
    return
  }
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: Task) {
  if (row.status !== 'draft') {
    ElMessage.warning('仅未发布任务可编辑')
    return
  }
  editingId.value = row.id
  form.value = {
    name: row.name,
    taskTypeId: row.taskTypeId,
    plannedTotal: row.plannedTotal,
    dateRange: [row.startTime.slice(0, 10), row.endTime.slice(0, 10)],
    dispatchMode: row.dispatchMode,
    assigneeIds: row.assigneeIds ? [...row.assigneeIds] : [],
    maxPerPerson: row.maxPerPerson ?? 5,
    region: row.region ?? '',
    description: row.description,
  }
  dialogVisible.value = true
}

function validate() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入任务名称')
    return false
  }
  if (!form.value.taskTypeId) {
    ElMessage.warning('请选择任务类型')
    return false
  }
  if (!form.value.dateRange?.length || form.value.dateRange.length < 2) {
    ElMessage.warning('请设置任务时间范围')
    return false
  }
  if (form.value.dispatchMode === 'assign' && !form.value.assigneeIds.length) {
    ElMessage.warning('指派模式请选择人员')
    return false
  }
  return true
}

function buildPayload() {
  return {
    name: form.value.name.trim(),
    taskTypeId: form.value.taskTypeId,
    plannedTotal: form.value.plannedTotal,
    startTime: `${form.value.dateRange[0]}T00:00:00.000Z`,
    endTime: `${form.value.dateRange[1]}T23:59:59.000Z`,
    dispatchMode: form.value.dispatchMode,
    assigneeIds: form.value.dispatchMode === 'assign' ? form.value.assigneeIds : undefined,
    maxPerPerson: form.value.maxPerPerson,
    region: form.value.region.trim() || undefined,
    description: form.value.description.trim(),
  }
}

function saveDraft() {
  if (!validate()) return
  try {
    const payload = buildPayload()
    if (editingId.value) {
      store.updateEnterpriseTask(editingId.value, payload)
      ElMessage.success('已保存')
    } else {
      store.addEnterpriseTask(enterpriseId.value, payload)
      ElMessage.success('已创建草稿')
    }
    dialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function saveAndPublish() {
  if (!validate()) return
  try {
    let id = editingId.value
    const payload = buildPayload()
    if (id) {
      store.updateEnterpriseTask(id, payload)
    } else {
      const created = store.addEnterpriseTask(enterpriseId.value, payload)
      id = created.id
    }
    await ElMessageBox.confirm('确认发布任务？发布后将出现在灵工端。', '发布确认')
    store.publishEnterpriseTask(id!)
    ElMessage.success('任务已发布')
    dialogVisible.value = false
  } catch (e) {
    if (e !== 'cancel' && e instanceof Error) ElMessage.error(e.message)
  }
}

async function publishRow(row: Task) {
  try {
    await ElMessageBox.confirm(`确认发布任务「${row.name}」？`, '发布确认')
    store.publishEnterpriseTask(row.id)
    ElMessage.success('任务已发布')
  } catch {
    // cancelled
  }
}

async function endRow(row: Task) {
  try {
    await ElMessageBox.confirm(`确定提前结束任务「${row.name}」？`, '提示', { type: 'warning' })
    store.endTask(row.id)
    ElMessage.success('任务已结束')
  } catch {
    // cancelled
  }
}

async function cancelRow(row: Task) {
  try {
    await ElMessageBox.confirm(`确定取消任务「${row.name}」？`, '提示', { type: 'warning' })
    store.cancelEnterpriseTask(row.id)
    ElMessage.success('任务已取消')
  } catch (e) {
    if (e instanceof Error && e.message !== 'cancel') ElMessage.error(e.message)
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">任务发布</h2>
        <p class="text-muted">基于已发布任务类型创建具体任务，指派灵工或发布至任务大厅</p>
      </div>
      <el-button type="primary" @click="openCreate">创建任务</el-button>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="任务名称" min-width="160" />
      <el-table-column prop="taskTypeName" label="任务类型" width="130" />
      <el-table-column prop="dispatchLabel" label="派单方式" width="100" />
      <el-table-column label="时间范围" min-width="180">
        <template #default="{ row }">
          {{ row.startTime.slice(0, 10) }} ~ {{ row.endTime.slice(0, 10) }}
        </template>
      </el-table-column>
      <el-table-column label="进度" min-width="140">
        <template #default="{ row }">
          接单 {{ row.acceptedCount }} · 完成 {{ row.completedCount }} · 验收 {{ row.approvedCount }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="
              row.status === 'active'
                ? 'success'
                : row.status === 'draft'
                  ? 'warning'
                  : 'info'
            "
          >
            {{ row.statusLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'draft'">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="success" @click="publishRow(row)">发布</el-button>
          </template>
          <template v-if="row.status === 'active'">
            <el-button link type="warning" @click="endRow(row)">结束</el-button>
            <el-button link type="danger" @click="cancelRow(row)">取消</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog
    v-model="dialogVisible"
    :title="editingId ? '编辑任务' : '创建任务'"
    width="680px"
    destroy-on-close
  >
    <el-form label-width="110px">
      <el-form-item label="任务类型" required>
        <el-select v-model="form.taskTypeId" style="width: 100%">
          <el-option
            v-for="t in publishedTypes"
            :key="t.id"
            :label="t.name"
            :value="t.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="任务名称" required>
        <el-input v-model="form.name" placeholder="默认：类型名+年月，可编辑" />
      </el-form-item>
      <el-form-item label="计划完成数">
        <el-input-number v-model="form.plannedTotal" :min="1" :max="99999" placeholder="非必填" />
      </el-form-item>
      <el-form-item label="时间范围" required>
        <el-date-picker
          v-model="form.dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始"
          end-placeholder="结束"
        />
      </el-form-item>
      <el-form-item label="派单方式" required>
        <el-radio-group v-model="form.dispatchMode">
          <el-radio value="hall">发布到任务大厅</el-radio>
          <el-radio value="assign">指派特定人员</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="form.dispatchMode === 'assign'" label="指派人员" required>
        <el-select v-model="form.assigneeIds" multiple filterable style="width: 100%">
          <el-option v-for="w in workerOptions" :key="w.value" :label="w.label" :value="w.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="限领规则">
        <span>每人最多</span>
        <el-input-number v-model="form.maxPerPerson" :min="1" :max="99" style="margin: 0 8px" />
        <span>单</span>
      </el-form-item>
      <el-form-item label="任务区域">
        <el-input v-model="form.region" placeholder="可选，电子围栏范围描述" />
      </el-form-item>
      <el-form-item label="任务说明">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button @click="saveDraft">暂存</el-button>
      <el-button type="primary" @click="saveAndPublish">确认发布</el-button>
    </template>
  </el-dialog>
</template>
