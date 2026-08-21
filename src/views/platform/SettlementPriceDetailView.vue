<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import SettlementHourlyRatesEditor from '@/components/settlement/SettlementHourlyRatesEditor.vue'
import { useAppStore } from '@/stores/app'
import { attendanceGroupTypeMap } from '@/constants/attendanceGroup'
import {
  createDefaultSettlementHourlyConfig,
  formatHourlySettlementDetail,
  getAttendanceGroupBaseHourly,
  getTaskTypeBasePriceLabel,
  getTaskTypeBaseUnitPrice,
  settlementHourlyConfigFromResolved,
} from '@/services/settlementPrice'
import type { AttendanceGroup, TaskType } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const enterpriseId = computed(() => route.params.enterpriseId as string)
const enterprise = computed(() => store.enterprises.find((e) => e.id === enterpriseId.value))
const activeTab = ref<'hourly' | 'task'>('hourly')

const groupDialogVisible = ref(false)
const batchDialogVisible = ref(false)
const taskDialogVisible = ref(false)
const editingGroup = ref<AttendanceGroup | null>(null)
const editingTaskType = ref<TaskType | null>(null)
const selectedGroupIds = ref<string[]>([])

const groupForm = ref({
  dailySettlement: false,
  autoSettlement: false,
  hourly: createDefaultSettlementHourlyConfig(),
})

const batchForm = ref({
  groupIds: [] as string[],
  dailySettlement: false,
  autoSettlement: false,
  hourly: createDefaultSettlementHourlyConfig(),
})

const taskForm = ref({
  unitPrice: 50,
})

const groupOptions = computed(() =>
  store.getAttendanceGroupsByEnterprise(enterpriseId.value).map((g) => ({
    id: g.id,
    name: g.name,
    typeLabel: attendanceGroupTypeMap[g.attendanceType],
  })),
)

const groupRows = computed(() =>
  store.getAttendanceGroupsByEnterprise(enterpriseId.value).map((group) => {
    const baseHourly = getAttendanceGroupBaseHourly(group)
    const workerHourly = store.resolveGroupSettlementPrice(enterpriseId.value, group.id)
    return {
      id: group.id,
      group,
      typeLabel: attendanceGroupTypeMap[group.attendanceType],
      dailySettlement: workerHourly.dailySettlement,
      autoSettlement: workerHourly.autoSettlement,
      baseHourlyDetails: formatHourlySettlementDetail(baseHourly),
      workerHourlyConfigured: workerHourly.configured,
      workerHourlyDetails: workerHourly.configured
        ? formatHourlySettlementDetail(workerHourly)
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

function applyHourlyToGroup(
  groupId: string,
  hourly: ReturnType<typeof createDefaultSettlementHourlyConfig>,
  dailySettlement: boolean,
  autoSettlement: boolean,
) {
  store.upsertAttendanceGroupSettlementOverride({
    attendanceGroupId: groupId,
    enterpriseId: enterpriseId.value,
    useEnterpriseDefault: false,
    dailySettlement,
    autoSettlement: dailySettlement ? autoSettlement : false,
    ...cloneHourly(hourly),
  })
}

function openGroupDialog(group: AttendanceGroup) {
  editingGroup.value = group
  const baseHourly = getAttendanceGroupBaseHourly(group)
  const workerHourly = store.resolveGroupSettlementPrice(enterpriseId.value, group.id)
  groupForm.value = {
    dailySettlement: workerHourly.dailySettlement,
    autoSettlement: workerHourly.autoSettlement,
    hourly: workerHourly.configured
      ? settlementHourlyConfigFromResolved(workerHourly)
      : cloneHourly(baseHourly),
  }
  groupDialogVisible.value = true
}

function onDailySettlementToggle(
  form: { dailySettlement: boolean; autoSettlement: boolean },
  enabled: boolean,
) {
  form.dailySettlement = enabled
  if (!enabled) form.autoSettlement = false
}

function onGroupDailyToggle(value: string | number | boolean) {
  onDailySettlementToggle(groupForm.value, !!value)
}

function onBatchDailyToggle(value: string | number | boolean) {
  onDailySettlementToggle(batchForm.value, !!value)
}

function saveGroupConfig() {
  if (!editingGroup.value) return
  const hourly = groupForm.value.hourly
  if (hourly.dayShiftRate < 0 || hourly.nightShiftRate < 0) {
    ElMessage.warning('结算价不能为负数')
    return
  }
  applyHourlyToGroup(
    editingGroup.value.id,
    hourly,
    groupForm.value.dailySettlement,
    groupForm.value.autoSettlement,
  )
  ElMessage.success('灵工工时结算价已保存')
  groupDialogVisible.value = false
}

function clearGroupWorkerPrice() {
  if (!editingGroup.value) return
  const existing = store.attendanceGroupSettlementOverrides.find(
    (o) =>
      o.attendanceGroupId === editingGroup.value!.id && o.enterpriseId === enterpriseId.value,
  )
  if (!existing) {
    groupDialogVisible.value = false
    return
  }
  store.upsertAttendanceGroupSettlementOverride({
    attendanceGroupId: editingGroup.value.id,
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
  ElMessage.success('已清除灵工工时结算价，将仅使用考勤组配置价')
  groupDialogVisible.value = false
}

function onGroupSelectionChange(rows: { id: string; group: AttendanceGroup }[]) {
  selectedGroupIds.value = rows.map((r) => r.id)
}

function openBatchDialog() {
  const groups = store.getAttendanceGroupsByEnterprise(enterpriseId.value)
  if (!groups.length) {
    ElMessage.warning('暂无可配置的考勤组')
    return
  }
  const seedGroup =
    groups.find((g) => selectedGroupIds.value.includes(g.id)) ?? groups[0]
  const baseHourly = getAttendanceGroupBaseHourly(seedGroup)
  const workerHourly = store.resolveGroupSettlementPrice(enterpriseId.value, seedGroup.id)
  batchForm.value = {
    groupIds: selectedGroupIds.value.length
      ? [...selectedGroupIds.value]
      : groups.map((g) => g.id),
    dailySettlement: workerHourly.dailySettlement,
    autoSettlement: workerHourly.autoSettlement,
    hourly: workerHourly.configured
      ? settlementHourlyConfigFromResolved(workerHourly)
      : cloneHourly(baseHourly),
  }
  batchDialogVisible.value = true
}

function saveBatchConfig() {
  if (!batchForm.value.groupIds.length) {
    ElMessage.warning('请选择至少一个考勤组')
    return
  }
  const hourly = batchForm.value.hourly
  if (hourly.dayShiftRate < 0 || hourly.nightShiftRate < 0) {
    ElMessage.warning('结算价不能为负数')
    return
  }
  for (const groupId of batchForm.value.groupIds) {
    applyHourlyToGroup(
      groupId,
      hourly,
      batchForm.value.dailySettlement,
      batchForm.value.autoSettlement,
    )
  }
  ElMessage.success(`已为 ${batchForm.value.groupIds.length} 个考勤组配置灵工工时结算价`)
  batchDialogVisible.value = false
  selectedGroupIds.value = []
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
</script>

<template>
  <div v-if="enterprise" class="settlement-detail-page">
    <div class="page-header">
      <div>
        <el-button link @click="goBack">← 返回结算价管理</el-button>
        <h2 class="page-title">{{ enterprise.name }} · 结算价配置</h2>
        <p class="text-muted">
          工时按考勤组、任务按任务类型分别对照展示；默认使用自身定价，单独配置后才产生灵工结算价。
        </p>
      </div>
    </div>

    <section class="section-card page-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane :label="`工时定价 (${groupRows.length})`" name="hourly">
          <div class="tab-toolbar">
            <p class="tab-tip text-muted">
              「考勤组结算价」来自考勤组定价；「灵工结算价」为在此单独配置的结果，未配置则无独立灵工工时价。
            </p>
            <el-button type="primary" :disabled="!groupRows.length" @click="openBatchDialog">
              批量配置
              <template v-if="selectedGroupIds.length">（已选 {{ selectedGroupIds.length }}）</template>
            </el-button>
          </div>
          <el-table
            :data="groupRows"
            border
            stripe
            empty-text="该企业暂无关联考勤组"
            row-key="id"
            @selection-change="onGroupSelectionChange"
          >
            <el-table-column type="selection" width="48" />
            <el-table-column prop="group.name" label="考勤组" min-width="130" fixed />
            <el-table-column prop="typeLabel" label="考勤类型" width="90" />
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
            <el-table-column label="考勤组结算价" min-width="220">
              <template #default="{ row }">
                <div class="settlement-detail-list">
                  <div v-for="item in row.baseHourlyDetails" :key="item.label" class="detail-row">
                    <span class="detail-label">{{ item.label }}</span>
                    <span>{{ item.value }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="灵工结算价" min-width="220">
              <template #default="{ row }">
                <div v-if="row.workerHourlyConfigured" class="settlement-detail-list worker-price">
                  <div v-for="item in row.workerHourlyDetails" :key="item.label" class="detail-row">
                    <span class="detail-label">{{ item.label }}</span>
                    <span>{{ item.value }}</span>
                  </div>
                </div>
                <el-tag v-else type="info" size="small">未配置</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="150">
              <template #default="{ row }">
                <el-tag :type="row.workerHourlyConfigured ? 'success' : 'warning'" size="small">
                  {{ row.workerHourlyConfigured ? '已配置灵工价' : '仅考勤组或任务单价' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openGroupDialog(row.group)">
                  配置灵工价
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
                  {{ row.workerConfigured ? '已配置灵工价' : '仅考勤组或任务单价' }}
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
    v-model="groupDialogVisible"
    :title="`灵工工时结算价 · ${editingGroup?.name ?? ''}`"
    width="640px"
  >
    <el-alert
      v-if="editingGroup"
      type="info"
      :closable="false"
      show-icon
      class="dialog-tip"
      :title="`参考考勤组结算价：白班 ¥${getAttendanceGroupBaseHourly(editingGroup).dayShiftRate}/h · 夜班 ¥${getAttendanceGroupBaseHourly(editingGroup).nightShiftRate}/h`"
    />
    <el-form label-width="120px">
      <el-form-item label="是否日结">
        <el-switch
          :model-value="groupForm.dailySettlement"
          active-text="日结"
          inactive-text="非日结"
          @update:model-value="onGroupDailyToggle"
        />
        <span class="field-hint">开启后，该考勤组灵工工时收入按日结算</span>
      </el-form-item>
      <el-form-item v-if="groupForm.dailySettlement" label="是否自动结算">
        <el-switch
          v-model="groupForm.autoSettlement"
          active-text="自动结算"
          inactive-text="人工确认"
        />
        <span class="field-hint">开启后无需人工确认工时，系统按日自动结算</span>
      </el-form-item>
      <SettlementHourlyRatesEditor v-model="groupForm.hourly" />
    </el-form>
    <template #footer>
      <el-button
        v-if="
          editingGroup &&
          store.resolveGroupSettlementPrice(enterpriseId, editingGroup.id).configured
        "
        type="danger"
        plain
        @click="clearGroupWorkerPrice"
      >
        清除灵工价
      </el-button>
      <el-button @click="groupDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveGroupConfig">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="batchDialogVisible" title="批量配置灵工工时结算价" width="680px">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="dialog-tip"
      title="将同一套灵工工时结算价应用到所选考勤组，已有配置会被覆盖"
    />
    <el-form label-width="120px">
      <el-form-item label="考勤组" required>
        <el-select
          v-model="batchForm.groupIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择考勤组"
          style="width: 100%"
        >
          <el-option
            v-for="opt in groupOptions"
            :key="opt.id"
            :label="`${opt.name}（${opt.typeLabel}）`"
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
        <span class="field-hint">对所选考勤组统一设置</span>
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
        应用到 {{ batchForm.groupIds.length }} 个考勤组
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
