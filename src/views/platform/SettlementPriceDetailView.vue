<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import SettlementHourlyRatesEditor from '@/components/settlement/SettlementHourlyRatesEditor.vue'
import { useAppStore } from '@/stores/app'
import { getDepartmentName } from '@/utils'
import {
  createDefaultSettlementHourlyConfig,
  formatHourlySettlementDetail,
  getTaskTypeBasePriceLabel,
  getTaskTypeBaseUnitPrice,
  listSettlementDepartmentsForEnterprise,
  resolveDepartmentAttendanceGroupId,
  settlementHourlyConfigFromResolved,
} from '@/services/settlementPrice'
import type { Department, TaskType } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const enterpriseId = computed(() => route.params.enterpriseId as string)
const enterprise = computed(() => store.enterprises.find((e) => e.id === enterpriseId.value))
const activeTab = ref<'hourly' | 'task'>('hourly')

const deptDialogVisible = ref(false)
const batchDialogVisible = ref(false)
const taskDialogVisible = ref(false)
const editingDept = ref<Department | null>(null)
const editingTaskType = ref<TaskType | null>(null)
const selectedDeptIds = ref<string[]>([])

const deptForm = ref({
  dailySettlement: false,
  autoSettlement: false,
  hourly: createDefaultSettlementHourlyConfig(),
})

const batchForm = ref({
  departmentIds: [] as string[],
  dailySettlement: false,
  autoSettlement: false,
  hourly: createDefaultSettlementHourlyConfig(),
})

const taskForm = ref({
  unitPrice: 50,
})

const settlementDepartments = computed(() =>
  listSettlementDepartmentsForEnterprise(
    enterpriseId.value,
    store.departments,
    store.attendanceGroups,
  ),
)

const deptOptions = computed(() =>
  settlementDepartments.value.map((d) => {
    const groupId = resolveDepartmentAttendanceGroupId(d, store.attendanceGroups)
    const group = groupId ? store.attendanceGroups.find((g) => g.id === groupId) : undefined
    return {
      id: d.id,
      name: getDepartmentName(store.departments, d.id),
      groupName: group?.name || '—',
    }
  }),
)

const deptRows = computed(() =>
  settlementDepartments.value.map((department) => {
    const groupId = resolveDepartmentAttendanceGroupId(department, store.attendanceGroups)
    const group = groupId ? store.attendanceGroups.find((g) => g.id === groupId) : undefined
    const groupPrice = groupId
      ? store.resolveGroupSettlementPrice(enterpriseId.value, groupId)
      : null
    const deptPrice = store.resolveDepartmentSettlementPrice(enterpriseId.value, department.id)
    return {
      id: department.id,
      department,
      departmentName: getDepartmentName(store.departments, department.id),
      groupId: groupId || '',
      groupName: group?.name || '未关联考勤组',
      dailySettlement: deptPrice.dailySettlement,
      autoSettlement: deptPrice.autoSettlement,
      groupHourlyDetails: groupPrice ? formatHourlySettlementDetail(groupPrice) : [],
      deptConfigured: deptPrice.departmentConfigured,
      deptHourlyDetails: deptPrice.departmentConfigured
        ? formatHourlySettlementDetail(deptPrice)
        : [],
    }
  }),
)

const taskRows = computed(() =>
  store.getTaskTypesByEnterprise(enterpriseId.value).map((taskType) => {
    const worker = store.resolveTaskTypeSettlementPrice(enterpriseId.value, taskType)
    return {
      taskType,
      basePriceLabel: getTaskTypeBasePriceLabel(taskType),
      workerConfigured: worker.configured,
      workerLabel: worker.configured ? `¥${worker.unitPrice}/单` : '',
    }
  }),
)

function cloneHourly(hourly: ReturnType<typeof createDefaultSettlementHourlyConfig>) {
  return {
    dayShiftRate: hourly.dayShiftRate,
    nightShiftRate: hourly.nightShiftRate,
    overtime: { ...hourly.overtime },
    weekend: { ...hourly.weekend },
    holiday: { ...hourly.holiday },
  }
}

function applyHourlyToDepartment(
  departmentId: string,
  hourly: ReturnType<typeof createDefaultSettlementHourlyConfig>,
  dailySettlement: boolean,
  autoSettlement: boolean,
) {
  store.upsertDepartmentSettlementOverride({
    departmentId,
    enterpriseId: enterpriseId.value,
    useEnterpriseDefault: false,
    dailySettlement,
    autoSettlement: dailySettlement ? autoSettlement : false,
    ...cloneHourly(hourly),
  })
}

function openDeptDialog(department: Department) {
  editingDept.value = department
  const groupId = resolveDepartmentAttendanceGroupId(department, store.attendanceGroups)
  const groupFallback = groupId
    ? store.resolveGroupSettlementPrice(enterpriseId.value, groupId)
    : null
  const deptPrice = store.resolveDepartmentSettlementPrice(enterpriseId.value, department.id)
  deptForm.value = {
    dailySettlement: deptPrice.departmentConfigured
      ? deptPrice.dailySettlement
      : (groupFallback?.dailySettlement ?? false),
    autoSettlement: deptPrice.departmentConfigured
      ? deptPrice.autoSettlement
      : (groupFallback?.autoSettlement ?? false),
    hourly: deptPrice.departmentConfigured
      ? settlementHourlyConfigFromResolved(deptPrice)
      : cloneHourly(groupFallback ?? createDefaultSettlementHourlyConfig()),
  }
  deptDialogVisible.value = true
}

function onDailySettlementToggle(
  form: { dailySettlement: boolean; autoSettlement: boolean },
  enabled: boolean,
) {
  form.dailySettlement = enabled
  if (!enabled) form.autoSettlement = false
}

function onDeptDailyToggle(value: string | number | boolean) {
  onDailySettlementToggle(deptForm.value, !!value)
}

function onBatchDailyToggle(value: string | number | boolean) {
  onDailySettlementToggle(batchForm.value, !!value)
}

function saveDeptConfig() {
  if (!editingDept.value) return
  const hourly = deptForm.value.hourly
  if (hourly.dayShiftRate < 0 || hourly.nightShiftRate < 0) {
    ElMessage.warning('结算价不能为负数')
    return
  }
  applyHourlyToDepartment(
    editingDept.value.id,
    hourly,
    deptForm.value.dailySettlement,
    deptForm.value.autoSettlement,
  )
  ElMessage.success('部门工时结算价已保存')
  deptDialogVisible.value = false
}

function clearDeptWorkerPrice() {
  if (!editingDept.value) return
  const existing = store.departmentSettlementOverrides.find(
    (o) =>
      o.departmentId === editingDept.value!.id && o.enterpriseId === enterpriseId.value,
  )
  if (!existing) {
    deptDialogVisible.value = false
    return
  }
  store.upsertDepartmentSettlementOverride({
    departmentId: editingDept.value.id,
    enterpriseId: enterpriseId.value,
    useEnterpriseDefault: true,
    dailySettlement: false,
    autoSettlement: false,
    dayShiftRate: undefined,
    nightShiftRate: undefined,
    overtime: undefined,
    weekend: undefined,
    holiday: undefined,
  })
  ElMessage.success('已清除部门结算价，将沿用考勤组配置价')
  deptDialogVisible.value = false
}

function onDeptSelectionChange(rows: { id: string }[]) {
  selectedDeptIds.value = rows.map((r) => r.id)
}

function openBatchDialog() {
  const depts = settlementDepartments.value
  if (!depts.length) {
    ElMessage.warning('暂无可配置的部门')
    return
  }
  const seedDept =
    depts.find((d) => selectedDeptIds.value.includes(d.id)) ?? depts[0]
  const groupId = resolveDepartmentAttendanceGroupId(seedDept, store.attendanceGroups)
  const groupFallback = groupId
    ? store.resolveGroupSettlementPrice(enterpriseId.value, groupId)
    : null
  const deptPrice = store.resolveDepartmentSettlementPrice(enterpriseId.value, seedDept.id)
  batchForm.value = {
    departmentIds: selectedDeptIds.value.length
      ? [...selectedDeptIds.value]
      : depts.map((d) => d.id),
    dailySettlement: deptPrice.departmentConfigured
      ? deptPrice.dailySettlement
      : (groupFallback?.dailySettlement ?? false),
    autoSettlement: deptPrice.departmentConfigured
      ? deptPrice.autoSettlement
      : (groupFallback?.autoSettlement ?? false),
    hourly: deptPrice.departmentConfigured
      ? settlementHourlyConfigFromResolved(deptPrice)
      : cloneHourly(groupFallback ?? createDefaultSettlementHourlyConfig()),
  }
  batchDialogVisible.value = true
}

function saveBatchConfig() {
  if (!batchForm.value.departmentIds.length) {
    ElMessage.warning('请选择至少一个部门')
    return
  }
  const hourly = batchForm.value.hourly
  if (hourly.dayShiftRate < 0 || hourly.nightShiftRate < 0) {
    ElMessage.warning('结算价不能为负数')
    return
  }
  for (const departmentId of batchForm.value.departmentIds) {
    applyHourlyToDepartment(
      departmentId,
      hourly,
      batchForm.value.dailySettlement,
      batchForm.value.autoSettlement,
    )
  }
  ElMessage.success(`已为 ${batchForm.value.departmentIds.length} 个部门配置工时结算价`)
  batchDialogVisible.value = false
  selectedDeptIds.value = []
}

function openTaskDialog(taskType: TaskType) {
  editingTaskType.value = taskType
  const worker = store.resolveTaskTypeSettlementPrice(enterpriseId.value, taskType)
  taskForm.value = {
    unitPrice: worker.configured ? worker.unitPrice : getTaskTypeBaseUnitPrice(taskType),
  }
  taskDialogVisible.value = true
}

function saveTaskConfig() {
  if (!editingTaskType.value) return
  if (taskForm.value.unitPrice < 0) {
    ElMessage.warning('结算价不能为负数')
    return
  }
  store.upsertTaskTypeSettlementOverride({
    taskTypeId: editingTaskType.value.id,
    enterpriseId: enterpriseId.value,
    useEnterpriseDefault: false,
    unitPrice: taskForm.value.unitPrice,
  })
  ElMessage.success('灵工任务结算价已保存')
  taskDialogVisible.value = false
}

function clearTaskWorkerPrice() {
  if (!editingTaskType.value) return
  const existing = store.taskTypeSettlementOverrides.find(
    (o) =>
      o.taskTypeId === editingTaskType.value!.id && o.enterpriseId === enterpriseId.value,
  )
  if (!existing) {
    taskDialogVisible.value = false
    return
  }
  store.upsertTaskTypeSettlementOverride({
    taskTypeId: editingTaskType.value.id,
    enterpriseId: enterpriseId.value,
    useEnterpriseDefault: true,
    unitPrice: undefined,
  })
  ElMessage.success('已清除灵工任务结算价，将仅使用任务类型定价')
  taskDialogVisible.value = false
}

function goBack() {
  router.push('/settlement-prices')
}

function editingDeptGroupHint() {
  if (!editingDept.value) return ''
  const groupId = resolveDepartmentAttendanceGroupId(editingDept.value, store.attendanceGroups)
  if (!groupId) return '该部门未关联考勤组'
  const group = store.attendanceGroups.find((g) => g.id === groupId)
  const price = store.resolveGroupSettlementPrice(enterpriseId.value, groupId)
  return `参考考勤组「${group?.name ?? groupId}」配置价：白班 ¥${price.dayShiftRate}/h · 夜班 ¥${price.nightShiftRate}/h`
}
</script>

<template>
  <div v-if="enterprise" class="settlement-detail-page">
    <div class="page-header">
      <div>
        <el-button link @click="goBack">← 返回结算价管理</el-button>
        <h2 class="page-title">{{ enterprise.name }} · 结算价配置</h2>
        <p class="text-muted">
          工时按部门配置结算价；未配置时沿用考勤组配置价。任务按任务类型单独配置灵工结算价。
        </p>
      </div>
    </div>

    <section class="section-card page-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane :label="`工时定价 (${deptRows.length})`" name="hourly">
          <div class="tab-toolbar">
            <p class="tab-tip text-muted">
              「考勤组配置价」来自考勤组灵工价或考勤组定价；「部门结算价」为在此单独配置的结果，未配置则沿用考勤组配置价。
            </p>
            <el-button type="primary" :disabled="!deptRows.length" @click="openBatchDialog">
              批量配置
              <template v-if="selectedDeptIds.length">（已选 {{ selectedDeptIds.length }}）</template>
            </el-button>
          </div>
          <el-table
            :data="deptRows"
            border
            stripe
            empty-text="该企业暂无关联考勤组的部门"
            row-key="id"
            @selection-change="onDeptSelectionChange"
          >
            <el-table-column type="selection" width="48" />
            <el-table-column prop="departmentName" label="部门" min-width="150" fixed />
            <el-table-column prop="groupName" label="所属考勤组" min-width="140" />
            <el-table-column label="日结" width="72" align="center">
              <template #default="{ row }">
                <el-tag :type="row.dailySettlement ? 'success' : 'info'" size="small">
                  {{ row.dailySettlement ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="自动结算" width="88" align="center">
              <template #default="{ row }">
                <el-tag
                  v-if="row.dailySettlement"
                  :type="row.autoSettlement ? 'success' : 'info'"
                  size="small"
                >
                  {{ row.autoSettlement ? '是' : '否' }}
                </el-tag>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="考勤组配置价" min-width="220">
              <template #default="{ row }">
                <div v-if="row.groupHourlyDetails.length" class="settlement-detail-list">
                  <div v-for="item in row.groupHourlyDetails" :key="item.label" class="detail-row">
                    <span class="detail-label">{{ item.label }}</span>
                    <span>{{ item.value }}</span>
                  </div>
                </div>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="部门结算价" min-width="220">
              <template #default="{ row }">
                <div v-if="row.deptConfigured" class="settlement-detail-list worker-price">
                  <div v-for="item in row.deptHourlyDetails" :key="item.label" class="detail-row">
                    <span class="detail-label">{{ item.label }}</span>
                    <span>{{ item.value }}</span>
                  </div>
                </div>
                <el-tag v-else type="info" size="small">未配置（沿用考勤组）</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="140">
              <template #default="{ row }">
                <el-tag :type="row.deptConfigured ? 'success' : 'warning'" size="small">
                  {{ row.deptConfigured ? '已配置部门价' : '沿用考勤组价' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDeptDialog(row.department)">
                  配置结算价
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="`任务定价 (${taskRows.length})`" name="task">
          <p class="tab-tip text-muted">
            「任务类型定价」来自任务类型配置；「灵工结算价」为在此单独配置的结果，未配置则无独立灵工任务价。
          </p>
          <el-table :data="taskRows" border stripe empty-text="该企业暂无任务类型">
            <el-table-column prop="taskType.name" label="任务类型" min-width="160" />
            <el-table-column label="任务类型定价" min-width="200">
              <template #default="{ row }">{{ row.basePriceLabel }}</template>
            </el-table-column>
            <el-table-column label="灵工结算价" width="140">
              <template #default="{ row }">
                <span v-if="row.workerConfigured" class="worker-task">{{ row.workerLabel }}</span>
                <el-tag v-else type="info" size="small">未配置</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="150">
              <template #default="{ row }">
                <el-tag :type="row.workerConfigured ? 'success' : 'warning'" size="small">
                  {{ row.workerConfigured ? '已配置灵工价' : '仅任务类型定价' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openTaskDialog(row.taskType)">
                  配置灵工价
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>

  <el-dialog
    v-model="deptDialogVisible"
    :title="`部门工时结算价 · ${editingDept ? getDepartmentName(store.departments, editingDept.id) : ''}`"
    width="640px"
  >
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="dialog-tip"
      :title="editingDeptGroupHint()"
    />
    <el-form label-width="120px">
      <el-form-item label="是否日结">
        <el-switch
          :model-value="deptForm.dailySettlement"
          active-text="日结"
          inactive-text="非日结"
          @update:model-value="onDeptDailyToggle"
        />
        <span class="field-hint">开启后，该部门灵工工时收入按日结算</span>
      </el-form-item>
      <el-form-item v-if="deptForm.dailySettlement" label="是否自动结算">
        <el-switch
          v-model="deptForm.autoSettlement"
          active-text="自动结算"
          inactive-text="人工确认"
        />
        <span class="field-hint">开启后无需人工确认工时，系统按日自动结算</span>
      </el-form-item>
      <SettlementHourlyRatesEditor v-model="deptForm.hourly" />
    </el-form>
    <template #footer>
      <el-button
        v-if="
          editingDept &&
          store.resolveDepartmentSettlementPrice(enterpriseId, editingDept.id).departmentConfigured
        "
        type="danger"
        plain
        @click="clearDeptWorkerPrice"
      >
        清除部门价
      </el-button>
      <el-button @click="deptDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveDeptConfig">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="batchDialogVisible" title="批量配置部门工时结算价" width="680px">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="dialog-tip"
      title="将同一套工时结算价应用到所选部门，已有配置会被覆盖"
    />
    <el-form label-width="120px">
      <el-form-item label="部门" required>
        <el-select
          v-model="batchForm.departmentIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择部门"
          style="width: 100%"
        >
          <el-option
            v-for="opt in deptOptions"
            :key="opt.id"
            :label="`${opt.name}（${opt.groupName}）`"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="是否日结">
        <el-switch
          :model-value="batchForm.dailySettlement"
          active-text="日结"
          inactive-text="非日结"
          @update:model-value="onBatchDailyToggle"
        />
        <span class="field-hint">对所选部门统一设置</span>
      </el-form-item>
      <el-form-item v-if="batchForm.dailySettlement" label="是否自动结算">
        <el-switch
          v-model="batchForm.autoSettlement"
          active-text="自动结算"
          inactive-text="人工确认"
        />
        <span class="field-hint">开启后无需人工确认工时</span>
      </el-form-item>
      <SettlementHourlyRatesEditor v-model="batchForm.hourly" />
    </el-form>
    <template #footer>
      <el-button @click="batchDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveBatchConfig">
        应用到 {{ batchForm.departmentIds.length }} 个部门
      </el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="taskDialogVisible"
    :title="`灵工任务结算价 · ${editingTaskType?.name ?? ''}`"
    width="480px"
  >
    <el-alert
      v-if="editingTaskType"
      type="info"
      :closable="false"
      show-icon
      class="dialog-tip"
      :title="`参考任务类型定价：${getTaskTypeBasePriceLabel(editingTaskType)}`"
    />
    <el-form label-width="120px">
      <el-form-item label="灵工结算价">
        <el-input-number v-model="taskForm.unitPrice" :min="0" :precision="2" />
        <span class="field-unit">元/单</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button
        v-if="
          editingTaskType &&
          store.resolveTaskTypeSettlementPrice(enterpriseId, editingTaskType).configured
        "
        type="danger"
        plain
        @click="clearTaskWorkerPrice"
      >
        清除灵工价
      </el-button>
      <el-button @click="taskDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveTaskConfig">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.settlement-detail-page {
  padding-bottom: 24px;
}

.page-header {
  margin-bottom: 16px;
}

.page-title {
  margin: 8px 0 4px;
}

.section-card {
  margin-bottom: 16px;
}

.tab-tip {
  margin: 0;
  font-size: 13px;
  flex: 1;
}

.tab-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.dialog-tip {
  margin-bottom: 16px;
}

.field-unit {
  margin-left: 8px;
  font-size: 13px;
  color: #909399;
}

.field-hint {
  margin-left: 12px;
  font-size: 12px;
  color: #909399;
}

.settlement-detail-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.settlement-detail-list.worker-price {
  color: #303133;
}

.worker-task {
  font-weight: 600;
  color: #303133;
}

.detail-row {
  display: flex;
  gap: 8px;
}

.detail-label {
  width: 48px;
  color: #909399;
  flex-shrink: 0;
}
</style>
