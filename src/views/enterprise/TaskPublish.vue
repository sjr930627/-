<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import TaskQuantityField from '@/components/task/TaskQuantityField.vue'
import TaskFormSection from '@/components/task/TaskFormSection.vue'
import {
  dispatchModeMap,
  formatTaskQuantity,
  formatTaskTypePrice,
  resolveTaskPricing,
  taskPublishStatusMap,
  workflowStatusMap,
} from '@/constants/task'
import type { PricingMode, Task, TieredPrice } from '@/types'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'

const store = useAppStore()
const dialogVisible = ref(false)
const formMode = ref<'create' | 'edit' | 'view'>('create')
const editingId = ref<string | null>(null)

const emptyTier = (): TieredPrice => ({ minCount: 1, maxCount: 10, unitPrice: 50 })

const form = ref({
  name: '',
  workflowId: '',
  departmentId: '',
  pricingMode: 'fixed' as PricingMode,
  fixedPrice: 50,
  tieredPrices: [emptyTier()] as TieredPrice[],
  incentive: '',
  trainingCourseId: '',
  plannedTotal: 100 as number | undefined,
  unlimitedQuantity: false,
  longTerm: false,
  dateRange: [] as string[],
  dispatchMode: 'hall' as 'assign' | 'hall',
  assigneeIds: [] as string[],
  maxPerPerson: 5,
  region: '',
  description: '',
})

const enterpriseId = computed(() => store.currentEnterpriseId)
const formReadonly = computed(() => formMode.value === 'view')

const departmentOptions = computed(() =>
  store.departments.filter((d) => {
    if (d.orgType === 'enterprise') return false
    if (d.id.includes('unassigned')) return false
    return resolveEnterpriseIdByDepartment(d.id, store.departments) === enterpriseId.value
  }),
)

const workflowOptions = computed(() =>
  store.enabledWorkflows
    .filter(
      (w) =>
        w.enterpriseScope === 'all' ||
        (w.enterpriseIds ?? []).includes(enterpriseId.value),
    )
    .map((w) => ({
      label: `${w.name}（${workflowStatusMap[w.status]}）`,
      value: w.id,
    })),
)

const workerOptions = computed(() =>
  store.activeEmployees.map((e) => ({ label: `${e.name}（${e.employeeNo}）`, value: e.id })),
)

const tableData = computed(() =>
  store.tasks
    .filter((t) => t.enterpriseId === enterpriseId.value)
    .map((t) => {
      const wf = store.taskWorkflows.find((w) => w.id === t.workflowId)
      const pricing = resolveTaskPricing(t, store.taskTypes)
      return {
        ...t,
        workflowName: wf?.name ?? t.taskTypeName,
        departmentLabel: t.departmentName || '—',
        priceLabel: pricing ? formatTaskTypePrice(pricing) : '-',
        statusLabel: taskPublishStatusMap[t.status],
        dispatchLabel: dispatchModeMap[t.dispatchMode],
        quantityLabel: formatTaskQuantity(t.unlimitedQuantity, t.plannedTotal),
        periodLabel: t.longTerm
          ? '长期'
          : `${t.startTime.slice(0, 10)} ~ ${t.endTime.slice(0, 10)}`,
      }
    }),
)

const dialogTitle = computed(() => {
  if (formMode.value === 'view') return '任务详情'
  if (formMode.value === 'edit') return '编辑任务'
  return '创建任务'
})

function resetForm() {
  const workflowId = workflowOptions.value[0]?.value ?? ''
  form.value = {
    name: workflowId ? store.suggestTaskName(workflowId) : '',
    workflowId,
    departmentId: departmentOptions.value[0]?.id ?? '',
    pricingMode: 'fixed',
    fixedPrice: 50,
    tieredPrices: [emptyTier()],
    incentive: '',
    trainingCourseId: '',
    plannedTotal: 100,
    unlimitedQuantity: false,
    longTerm: false,
    dateRange: ['2026-07-26', '2026-08-26'],
    dispatchMode: 'hall',
    assigneeIds: [],
    maxPerPerson: 5,
    region: '',
    description: '',
  }
}

function fillFormFromTask(row: Task) {
  const pricing = resolveTaskPricing(row, store.taskTypes)
  form.value = {
    name: row.name,
    workflowId: row.workflowId,
    departmentId: row.departmentId ?? departmentOptions.value[0]?.id ?? '',
    pricingMode: pricing?.pricingMode ?? 'fixed',
    fixedPrice: pricing?.fixedPrice ?? 50,
    tieredPrices: pricing?.tieredPrices?.length
      ? pricing.tieredPrices.map((t) => ({ ...t }))
      : [emptyTier()],
    incentive: row.incentive ?? '',
    trainingCourseId: row.trainingCourseId ?? '',
    plannedTotal: row.plannedTotal,
    unlimitedQuantity: row.unlimitedQuantity ?? row.plannedTotal == null,
    longTerm: row.longTerm ?? false,
    dateRange: row.longTerm ? [] : [row.startTime.slice(0, 10), row.endTime.slice(0, 10)],
    dispatchMode: row.dispatchMode,
    assigneeIds: row.assigneeIds ? [...row.assigneeIds] : [],
    maxPerPerson: row.maxPerPerson ?? 5,
    region: row.region ?? '',
    description: row.description,
  }
}

watch(
  () => form.value.workflowId,
  (id) => {
    if (id && formMode.value === 'create') {
      form.value.name = store.suggestTaskName(id)
    }
  },
)

function openCreate() {
  if (!workflowOptions.value.length) {
    ElMessage.warning('暂无可用任务流程，请联系平台配置')
    return
  }
  if (!departmentOptions.value.length) {
    ElMessage.warning('暂无可用部门/公司，请先配置组织架构')
    return
  }
  formMode.value = 'create'
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: Task) {
  if (row.status !== 'draft' && row.status !== 'rejected') {
    ElMessage.warning('仅未发布或已驳回任务可编辑')
    return
  }
  formMode.value = 'edit'
  editingId.value = row.id
  fillFormFromTask(row)
  dialogVisible.value = true
}

function openDetail(row: Task) {
  formMode.value = 'view'
  editingId.value = row.id
  fillFormFromTask(row)
  dialogVisible.value = true
}

function addTier() {
  const last = form.value.tieredPrices[form.value.tieredPrices.length - 1]
  form.value.tieredPrices.push({
    minCount: (last?.maxCount ?? 0) + 1,
    maxCount: (last?.maxCount ?? 0) + 10,
    unitPrice: (last?.unitPrice ?? 50) + 10,
  })
}

function removeTier(index: number) {
  if (form.value.tieredPrices.length <= 1) return
  form.value.tieredPrices.splice(index, 1)
}

function validate() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入任务名称')
    return false
  }
  if (!form.value.workflowId) {
    ElMessage.warning('请选择任务流程配置')
    return false
  }
  if (!form.value.departmentId) {
    ElMessage.warning('请选择部门/公司')
    return false
  }
  if (!form.value.description.trim()) {
    ElMessage.warning('请填写任务内容')
    return false
  }
  if (form.value.pricingMode === 'fixed' && (!form.value.fixedPrice || form.value.fixedPrice < 1)) {
    ElMessage.warning('请填写固定单价')
    return false
  }
  if (form.value.pricingMode === 'tiered' && !form.value.tieredPrices.length) {
    ElMessage.warning('请配置阶梯单价')
    return false
  }
  if (!form.value.unlimitedQuantity && (!form.value.plannedTotal || form.value.plannedTotal < 1)) {
    ElMessage.warning('请填写任务数量或选择无上限')
    return false
  }
  if (!form.value.longTerm && (!form.value.dateRange?.length || form.value.dateRange.length < 2)) {
    ElMessage.warning('请设置任务期限或选择长期')
    return false
  }
  if (!form.value.region.trim()) {
    ElMessage.warning('请填写任务地点')
    return false
  }
  if (form.value.dispatchMode === 'assign' && !form.value.assigneeIds.length) {
    ElMessage.warning('指派模式请选择人员')
    return false
  }
  return true
}

function buildPayload(): Omit<
  Task,
  | 'id'
  | 'enterpriseId'
  | 'enterpriseName'
  | 'taskTypeName'
  | 'status'
  | 'acceptedCount'
  | 'completedCount'
  | 'approvedCount'
  | 'createdAt'
> {
  const now = new Date()
  const start = form.value.longTerm
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00.000Z`
    : `${form.value.dateRange[0]}T00:00:00.000Z`
  const end = form.value.longTerm
    ? '2099-12-31T23:59:59.000Z'
    : `${form.value.dateRange[1]}T23:59:59.000Z`

  return {
    name: form.value.name.trim(),
    workflowId: form.value.workflowId,
    departmentId: form.value.departmentId,
    departmentName: store.departments.find((d) => d.id === form.value.departmentId)?.name,
    pricingMode: form.value.pricingMode,
    fixedPrice: form.value.pricingMode === 'fixed' ? form.value.fixedPrice : undefined,
    tieredPrices: form.value.pricingMode === 'tiered' ? form.value.tieredPrices : undefined,
    incentive: form.value.incentive.trim() || undefined,
    trainingCourseId: form.value.trainingCourseId.trim() || undefined,
    unlimitedQuantity: form.value.unlimitedQuantity,
    plannedTotal: form.value.unlimitedQuantity ? undefined : form.value.plannedTotal,
    longTerm: form.value.longTerm,
    startTime: start,
    endTime: end,
    dispatchMode: form.value.dispatchMode,
    assigneeIds: form.value.dispatchMode === 'assign' ? form.value.assigneeIds : undefined,
    maxPerPerson: form.value.maxPerPerson,
    region: form.value.region.trim(),
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
    await ElMessageBox.confirm(
      '确认提交发布？提交后将由平台审核，通过后进入任务大厅。',
      '发布确认',
    )
    store.publishEnterpriseTask(id!)
    ElMessage.success('已提交审核')
    dialogVisible.value = false
  } catch (e) {
    if (e !== 'cancel' && e instanceof Error) ElMessage.error(e.message)
  }
}

async function publishRow(row: Task) {
  try {
    await ElMessageBox.confirm(
      `确认提交任务「${row.name}」审核？通过后将进入任务大厅。`,
      '发布确认',
    )
    store.publishEnterpriseTask(row.id)
    ElMessage.success('已提交审核')
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
        <p class="text-muted">
          创建并提交任务 · 平台审核通过后进入任务大厅，按任务流程流转
        </p>
      </div>
      <el-button type="primary" @click="openCreate">创建任务</el-button>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="任务名称" min-width="160" />
      <el-table-column prop="departmentLabel" label="部门/公司" min-width="130" show-overflow-tooltip />
      <el-table-column prop="workflowName" label="任务流程" min-width="140" />
      <el-table-column prop="priceLabel" label="单价" min-width="140" show-overflow-tooltip />
      <el-table-column prop="quantityLabel" label="任务数量" width="100" />
      <el-table-column prop="dispatchLabel" label="派单方式" width="100" />
      <el-table-column label="任务期限" min-width="180">
        <template #default="{ row }">{{ row.periodLabel }}</template>
      </el-table-column>
      <el-table-column label="进度" min-width="140">
        <template #default="{ row }">
          接单 {{ row.acceptedCount }} · 完成 {{ row.completedCount }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="
              row.status === 'active'
                ? 'success'
                : row.status === 'pending'
                  ? 'warning'
                  : row.status === 'rejected'
                    ? 'danger'
                    : 'info'
            "
          >
            {{ row.statusLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <template v-if="row.status === 'draft' || row.status === 'rejected'">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="success" @click="publishRow(row)">提交审核</el-button>
          </template>
          <template v-if="row.status === 'pending'">
            <span class="text-muted">待平台审核</span>
          </template>
          <template v-if="row.status === 'active'">
            <el-button link type="warning" @click="endRow(row)">结束</el-button>
            <el-button link type="danger" @click="cancelRow(row)">取消</el-button>
          </template>
          <span v-if="row.status === 'rejected' && row.reviewNote" class="text-muted reject-note">
            {{ row.reviewNote }}
          </span>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="760px"
    destroy-on-close
    class="task-form-dialog"
  >
    <el-form label-width="110px" :disabled="formReadonly">
      <TaskFormSection title="基本信息" subtitle="流程配置、名称与内容" icon="基" icon-variant="blue">
        <el-form-item label="部门/公司" required>
          <el-select
            v-model="form.departmentId"
            placeholder="选择发布归属部门或公司"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="d in departmentOptions"
              :key="d.id"
              :label="d.name"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="任务流程配置" required>
          <el-select v-model="form.workflowId" placeholder="选择已启用流程" style="width: 100%">
            <el-option
              v-for="opt in workflowOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="任务名称" required>
          <el-input v-model="form.name" placeholder="默认：流程名+年月，可编辑" />
        </el-form-item>
        <el-form-item label="任务内容" required>
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="对灵工展示的任务说明"
          />
        </el-form-item>
        <el-form-item label="任务地点" required>
          <el-input v-model="form.region" placeholder="如：北京市朝阳区建国路商圈" />
        </el-form-item>
      </TaskFormSection>

      <TaskFormSection title="定价配置" subtitle="固定单价或阶梯单价" icon="价" icon-variant="green">
        <el-form-item label="单价模式">
          <el-radio-group v-model="form.pricingMode">
            <el-radio value="fixed">固定单价</el-radio>
            <el-radio value="tiered">阶梯单价</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.pricingMode === 'fixed'" label="固定单价">
          <el-input-number v-model="form.fixedPrice" :min="1" :max="9999" /> 元/单
        </el-form-item>
        <template v-else>
          <el-form-item label="阶梯单价">
            <div class="tier-list">
              <div v-for="(tier, index) in form.tieredPrices" :key="index" class="tier-row">
                <el-input-number v-model="tier.minCount" :min="1" controls-position="right" />
                <span>~</span>
                <el-input-number
                  v-model="tier.maxCount"
                  :min="tier.minCount"
                  controls-position="right"
                />
                <span>单</span>
                <el-input-number v-model="tier.unitPrice" :min="1" controls-position="right" />
                <span>元/单</span>
                <el-button
                  v-if="!formReadonly"
                  text
                  type="danger"
                  :disabled="form.tieredPrices.length <= 1"
                  @click="removeTier(index)"
                >
                  删除
                </el-button>
              </div>
              <el-button v-if="!formReadonly" size="small" @click="addTier">添加阶梯</el-button>
            </div>
          </el-form-item>
        </template>
        <el-form-item label="任务激励">
          <el-input v-model="form.incentive" placeholder="可选，如排名奖励" />
        </el-form-item>
        <el-form-item label="培训要求">
          <el-input v-model="form.trainingCourseId" placeholder="可选，关联培训课程 ID" />
        </el-form-item>
      </TaskFormSection>

      <TaskFormSection title="数量、期限与派单" subtitle="数量必填，期限可选长期" icon="派" icon-variant="orange">
        <el-form-item label="任务数量" required>
          <TaskQuantityField
            v-model="form.plannedTotal"
            v-model:unlimited="form.unlimitedQuantity"
          />
        </el-form-item>
        <el-form-item label="任务期限">
          <el-radio-group v-model="form.longTerm">
            <el-radio :value="true">长期</el-radio>
            <el-radio :value="false">指定时间段</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="!form.longTerm" label="时间范围" required>
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
      </TaskFormSection>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">{{ formReadonly ? '关闭' : '取消' }}</el-button>
      <template v-if="!formReadonly">
        <el-button @click="saveDraft">暂存</el-button>
        <el-button type="primary" @click="saveAndPublish">提交审核</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
.tier-list {
  width: 100%;
}

.tier-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.reject-note {
  display: block;
  font-size: 12px;
  margin-top: 4px;
}
</style>
