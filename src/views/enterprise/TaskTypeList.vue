<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import TaskQuantityField from '@/components/task/TaskQuantityField.vue'
import TaskFormSection from '@/components/task/TaskFormSection.vue'
import {
  formatTaskQuantity,
  formatTaskTypePrice,
  taskTypeStatusMap,
  workflowStatusMap,
} from '@/constants/task'
import type { TaskType, TieredPrice } from '@/types'

const store = useAppStore()
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const emptyTier = (): TieredPrice => ({ minCount: 1, maxCount: 10, unitPrice: 50 })

const form = ref({
  name: '',
  workflowId: '',
  pricingMode: 'fixed' as 'fixed' | 'tiered',
  fixedPrice: 50,
  tieredPrices: [emptyTier()] as TieredPrice[],
  incentive: '',
  description: '',
  trainingCourseId: '',
  longTerm: true,
  unlimitedQuantity: false,
  defaultQuantity: 100,
  validFrom: '',
  validTo: '',
})

const enterpriseId = computed(() => store.currentEnterpriseId)

const tableData = computed(() =>
  store.taskTypes
    .filter((t) => t.enterpriseId === enterpriseId.value)
    .map((t) => {
      const wf = store.taskWorkflows.find((w) => w.id === t.workflowId)
      return {
        ...t,
        workflowName: wf?.name ?? '-',
        workflowEnabled: wf?.status === 'enabled',
        priceLabel: formatTaskTypePrice(t),
        quantityLabel: formatTaskQuantity(t.unlimitedQuantity, t.defaultQuantity),
        statusLabel: taskTypeStatusMap[t.status],
        validityLabel: t.longTerm
          ? '长期有效'
          : `${t.validFrom ?? '-'} ~ ${t.validTo ?? '-'}`,
      }
    }),
)

const workflowOptions = computed(() =>
  store.enabledWorkflows.map((w) => ({
    label: `${w.name}（${workflowStatusMap[w.status]}）`,
    value: w.id,
  })),
)

function resetForm() {
  form.value = {
    name: '',
    workflowId: store.enabledWorkflows[0]?.id ?? '',
    pricingMode: 'fixed',
    fixedPrice: 50,
    tieredPrices: [emptyTier()],
    incentive: '',
    description: '',
    trainingCourseId: '',
    longTerm: true,
    unlimitedQuantity: false,
    defaultQuantity: 100,
    validFrom: '',
    validTo: '',
  }
}

function openCreate() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: TaskType) {
  editingId.value = row.id
  form.value = {
    name: row.name,
    workflowId: row.workflowId,
    pricingMode: row.pricingMode,
    fixedPrice: row.fixedPrice ?? 50,
    tieredPrices: row.tieredPrices?.length ? row.tieredPrices.map((t) => ({ ...t })) : [emptyTier()],
    incentive: row.incentive ?? '',
    description: row.description,
    trainingCourseId: row.trainingCourseId ?? '',
    longTerm: row.longTerm,
    unlimitedQuantity: row.unlimitedQuantity ?? false,
    defaultQuantity: row.defaultQuantity ?? 100,
    validFrom: row.validFrom ?? '',
    validTo: row.validTo ?? '',
  }
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

function buildPayload() {
  return {
    name: form.value.name.trim(),
    workflowId: form.value.workflowId,
    pricingMode: form.value.pricingMode,
    fixedPrice: form.value.pricingMode === 'fixed' ? form.value.fixedPrice : undefined,
    tieredPrices: form.value.pricingMode === 'tiered' ? form.value.tieredPrices : undefined,
    incentive: form.value.incentive.trim() || undefined,
    description: form.value.description.trim(),
    trainingCourseId: form.value.trainingCourseId.trim() || undefined,
    longTerm: form.value.longTerm,
    unlimitedQuantity: form.value.unlimitedQuantity,
    defaultQuantity: form.value.unlimitedQuantity ? undefined : form.value.defaultQuantity,
    validFrom: form.value.longTerm ? undefined : form.value.validFrom,
    validTo: form.value.longTerm ? undefined : form.value.validTo,
  }
}

function validate() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入任务类型名称')
    return false
  }
  if (!form.value.workflowId) {
    ElMessage.warning('请选择关联工作流')
    return false
  }
  if (!form.value.description.trim()) {
    ElMessage.warning('请填写任务描述')
    return false
  }
  if (!form.value.longTerm && (!form.value.validFrom || !form.value.validTo)) {
    ElMessage.warning('请设置有效期限')
    return false
  }
  if (!form.value.unlimitedQuantity && (!form.value.defaultQuantity || form.value.defaultQuantity < 1)) {
    ElMessage.warning('请填写任务数量或选择无上限')
    return false
  }
  return true
}

function saveDraft() {
  if (!validate()) return
  try {
    const payload = buildPayload()
    if (editingId.value) {
      store.updateEnterpriseTaskType(editingId.value, payload)
      ElMessage.success('已保存草稿')
    } else {
      store.addEnterpriseTaskType(enterpriseId.value, payload)
      ElMessage.success('已创建草稿')
    }
    dialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function saveAndSubmit() {
  if (!validate()) return
  try {
    let id = editingId.value
    const payload = buildPayload()
    if (id) {
      store.updateEnterpriseTaskType(id, payload)
    } else {
      const created = store.addEnterpriseTaskType(enterpriseId.value, payload)
      id = created.id
    }
    store.submitEnterpriseTaskType(id!)
    ElMessage.success('已提交审批，请等待运营审核')
    dialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败')
  }
}

async function submitRow(row: TaskType) {
  try {
    await ElMessageBox.confirm(`提交「${row.name}」至运营后台审批？`, '提交审批')
    store.submitEnterpriseTaskType(row.id)
    ElMessage.success('已提交审批')
  } catch {
    // cancelled
  }
}

async function disableRow(row: TaskType) {
  try {
    await ElMessageBox.confirm(`停用后不可新建该类型任务，已有任务不受影响。确定停用？`, '停用')
    store.disableEnterpriseTaskType(row.id)
    ElMessage.success('已停用')
  } catch (e) {
    if (e instanceof Error && e.message !== 'cancel') ElMessage.error(e.message)
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">任务类型管理</h2>
        <p class="text-muted">
          创建任务类型、关联工作流并设置单价，提交运营审批后生效 · {{ store.currentEnterprise?.name }}
        </p>
      </div>
      <el-button type="primary" @click="openCreate">新建任务类型</el-button>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="类型名称" min-width="140" />
      <el-table-column prop="workflowName" label="关联工作流" min-width="160">
        <template #default="{ row }">
          {{ row.workflowName }}
          <el-tag v-if="!row.workflowEnabled" size="small" type="warning">已停用</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="priceLabel" label="单价" min-width="160" show-overflow-tooltip />
      <el-table-column prop="quantityLabel" label="任务数量" width="110" />
      <el-table-column prop="validityLabel" label="有效期" width="160" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="
              row.status === 'published'
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
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'draft' || row.status === 'rejected'">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="success" @click="submitRow(row)">提交审批</el-button>
          </template>
          <template v-if="row.status === 'published'">
            <el-button link type="warning" @click="disableRow(row)">停用</el-button>
          </template>
          <el-tooltip v-if="row.status === 'rejected'" :content="row.reviewNote ?? ''">
            <span class="text-muted reject-note">{{ row.reviewNote ?? '查看驳回原因' }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog
    v-model="dialogVisible"
    :title="editingId ? '编辑任务类型' : '新建任务类型'"
    width="760px"
    destroy-on-close
    class="task-form-dialog"
  >
    <el-form label-width="100px">
      <TaskFormSection title="基本信息" subtitle="类型名称、工作流与描述" icon="基" icon-variant="blue">
        <el-form-item label="类型名称" required>
          <el-input v-model="form.name" placeholder="如：5G套餐推广" />
        </el-form-item>
        <el-form-item label="关联工作流" required>
          <el-select v-model="form.workflowId" placeholder="选择已启用工作流" style="width: 100%">
            <el-option
              v-for="opt in workflowOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="任务描述" required>
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="对灵工展示的任务说明" />
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
                <el-input-number v-model="tier.maxCount" :min="tier.minCount" controls-position="right" />
                <span>单</span>
                <el-input-number v-model="tier.unitPrice" :min="1" controls-position="right" />
                <span>元/单</span>
                <el-button text type="danger" :disabled="form.tieredPrices.length <= 1" @click="removeTier(index)">
                  删除
                </el-button>
              </div>
              <el-button size="small" @click="addTier">添加阶梯</el-button>
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

      <TaskFormSection title="数量与期限" subtitle="任务数量必填，可选无上限" icon="量" icon-variant="orange">
        <el-form-item label="任务数量" required>
          <TaskQuantityField
            v-model="form.defaultQuantity"
            v-model:unlimited="form.unlimitedQuantity"
          />
        </el-form-item>
        <el-form-item label="有效期">
          <el-radio-group v-model="form.longTerm">
            <el-radio :value="true">长期有效</el-radio>
            <el-radio :value="false">指定时间段</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="!form.longTerm" label="时间范围">
          <el-date-picker
            v-model="form.validFrom"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="开始"
          />
          <span style="margin: 0 8px">至</span>
          <el-date-picker
            v-model="form.validTo"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="结束"
          />
        </el-form-item>
      </TaskFormSection>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button @click="saveDraft">保存草稿</el-button>
      <el-button type="primary" @click="saveAndSubmit">提交审批</el-button>
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
  font-size: 12px;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
}
</style>
