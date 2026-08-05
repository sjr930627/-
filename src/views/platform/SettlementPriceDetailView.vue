<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import SettlementHourlyRatesEditor from '@/components/settlement/SettlementHourlyRatesEditor.vue'
import { useAppStore } from '@/stores/app'
import { attendanceGroupTypeMap } from '@/constants/attendanceGroup'
import { formatTaskTypePrice } from '@/constants/task'
import {
  createDefaultSettlementHourlyConfig,
  formatHourlySettlement,
  formatHourlySettlementDetail,
  settlementHourlyConfigFromResolved,
} from '@/services/settlementPrice'
import type { AttendanceGroup, SettlementHourlyConfig, TaskType } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const enterpriseId = computed(() => route.params.enterpriseId as string)
const enterprise = computed(() => store.enterprises.find((e) => e.id === enterpriseId.value))
const activeTab = ref<'hourly' | 'task'>('hourly')

const enterpriseHourlyForm = ref<SettlementHourlyConfig>(createDefaultSettlementHourlyConfig())
const enterpriseTaskUnitPrice = ref(50)

const groupDialogVisible = ref(false)
const taskDialogVisible = ref(false)
const editingGroup = ref<AttendanceGroup | null>(null)
const editingTaskType = ref<TaskType | null>(null)

const groupForm = ref({
  useEnterpriseDefault: true,
  dailySettlement: false,
  hourly: createDefaultSettlementHourlyConfig(),
})

const taskForm = ref({
  useEnterpriseDefault: true,
  unitPrice: 50,
})

function loadEnterpriseForm() {
  const config = store.getEnterpriseSettlementConfig(enterpriseId.value)
  enterpriseHourlyForm.value = {
    dayShiftRate: config.dayShiftRate,
    nightShiftRate: config.nightShiftRate,
    overtime: { ...config.overtime },
    weekend: { ...config.weekend },
    holiday: { ...config.holiday },
  }
  enterpriseTaskUnitPrice.value = config.taskUnitPrice
}

watch(enterpriseId, loadEnterpriseForm, { immediate: true })

const groupRows = computed(() =>
  store.getAttendanceGroupsByEnterprise(enterpriseId.value).map((group) => {
    const resolved = store.resolveGroupSettlementPrice(enterpriseId.value, group.id)
    return {
      group,
      typeLabel: attendanceGroupTypeMap[group.attendanceType],
      settlementLabel: formatHourlySettlement(resolved),
      settlementDetails: formatHourlySettlementDetail(resolved),
      dailySettlement: resolved.dailySettlement,
      sourceLabel: resolved.sourceLabel,
      sourceType: resolved.source === 'custom' ? 'warning' : 'info',
    }
  }),
)

const taskRows = computed(() =>
  store.getTaskTypesByEnterprise(enterpriseId.value).map((taskType) => {
    const resolved = store.resolveTaskTypeSettlementPrice(enterpriseId.value, taskType)
    return {
      taskType,
      pricingLabel: formatTaskTypePrice(taskType),
      settlementLabel: `¥${resolved.unitPrice}/单`,
      sourceLabel: resolved.sourceLabel,
      sourceType: resolved.source === 'custom' ? 'warning' : 'info',
      pricingNote: resolved.pricingNote,
    }
  }),
)

function saveEnterpriseConfig() {
  const hourly = enterpriseHourlyForm.value
  if (hourly.dayShiftRate < 0 || hourly.nightShiftRate < 0 || enterpriseTaskUnitPrice.value < 0) {
    ElMessage.warning('结算价不能为负数')
    return
  }
  store.updateEnterpriseSettlementConfig(enterpriseId.value, {
    dayShiftRate: hourly.dayShiftRate,
    nightShiftRate: hourly.nightShiftRate,
    overtime: { ...hourly.overtime },
    weekend: { ...hourly.weekend },
    holiday: { ...hourly.holiday },
    taskUnitPrice: enterpriseTaskUnitPrice.value,
  })
  ElMessage.success('企业默认结算价已保存')
}

function openGroupDialog(group: AttendanceGroup) {
  editingGroup.value = group
  const resolved = store.resolveGroupSettlementPrice(enterpriseId.value, group.id)
  const override = store.attendanceGroupSettlementOverrides.find(
    (o) => o.attendanceGroupId === group.id && o.enterpriseId === enterpriseId.value,
  )
  groupForm.value = {
    useEnterpriseDefault: override?.useEnterpriseDefault ?? resolved.source === 'enterprise',
    dailySettlement: override?.dailySettlement ?? resolved.dailySettlement,
    hourly: settlementHourlyConfigFromResolved(resolved),
  }
  groupDialogVisible.value = true
}

function saveGroupOverride() {
  if (!editingGroup.value) return
  const hourly = groupForm.value.hourly
  if (!groupForm.value.useEnterpriseDefault) {
    if (hourly.dayShiftRate < 0 || hourly.nightShiftRate < 0) {
      ElMessage.warning('结算价不能为负数')
      return
    }
  }
  store.upsertAttendanceGroupSettlementOverride({
    attendanceGroupId: editingGroup.value.id,
    enterpriseId: enterpriseId.value,
    useEnterpriseDefault: groupForm.value.useEnterpriseDefault,
    dailySettlement: groupForm.value.dailySettlement,
    dayShiftRate: groupForm.value.useEnterpriseDefault ? undefined : hourly.dayShiftRate,
    nightShiftRate: groupForm.value.useEnterpriseDefault ? undefined : hourly.nightShiftRate,
    overtime: groupForm.value.useEnterpriseDefault ? undefined : { ...hourly.overtime },
    weekend: groupForm.value.useEnterpriseDefault ? undefined : { ...hourly.weekend },
    holiday: groupForm.value.useEnterpriseDefault ? undefined : { ...hourly.holiday },
  })
  ElMessage.success('考勤组工时结算价已保存')
  groupDialogVisible.value = false
}

function openTaskDialog(taskType: TaskType) {
  editingTaskType.value = taskType
  const resolved = store.resolveTaskTypeSettlementPrice(enterpriseId.value, taskType)
  const override = store.taskTypeSettlementOverrides.find(
    (o) => o.taskTypeId === taskType.id && o.enterpriseId === enterpriseId.value,
  )
  taskForm.value = {
    useEnterpriseDefault: override?.useEnterpriseDefault ?? resolved.source === 'enterprise',
    unitPrice: override?.unitPrice ?? resolved.unitPrice,
  }
  taskDialogVisible.value = true
}

function saveTaskOverride() {
  if (!editingTaskType.value) return
  if (!taskForm.value.useEnterpriseDefault && taskForm.value.unitPrice < 0) {
    ElMessage.warning('结算价不能为负数')
    return
  }
  store.upsertTaskTypeSettlementOverride({
    taskTypeId: editingTaskType.value.id,
    enterpriseId: enterpriseId.value,
    useEnterpriseDefault: taskForm.value.useEnterpriseDefault,
    unitPrice: taskForm.value.useEnterpriseDefault ? undefined : taskForm.value.unitPrice,
  })
  ElMessage.success('任务类型结算价已保存')
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
          企业默认工时价含白班/夜班及加班、周末、节假日；考勤组与任务类型可单独定制
        </p>
      </div>
    </div>

    <section class="section-card page-card">
      <h3 class="section-title">企业默认结算价</h3>
      <el-form label-position="top">
        <SettlementHourlyRatesEditor v-model="enterpriseHourlyForm" />
        <el-form-item label="任务结算价" class="task-price-item">
          <el-input-number v-model="enterpriseTaskUnitPrice" :min="0" :precision="2" />
          <span class="field-unit">元/单</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveEnterpriseConfig">保存企业默认价</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="section-card page-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane :label="`工时定价 (${groupRows.length})`" name="hourly">
          <p class="tab-tip text-muted">
            按考勤组配置灵工工时结算价（含加班、周末、节假日），未单独配置则继承企业默认。
          </p>
          <el-table :data="groupRows" border stripe empty-text="该企业暂无关联考勤组">
            <el-table-column prop="group.name" label="考勤组" min-width="140" />
            <el-table-column prop="typeLabel" label="考勤类型" width="100" />
            <el-table-column label="日结" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.dailySettlement ? 'success' : 'info'" size="small">
                  {{ row.dailySettlement ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="当前工时结算价" min-width="280">
              <template #default="{ row }">
                <div class="settlement-detail-list">
                  <div v-for="item in row.settlementDetails" :key="item.label" class="detail-row">
                    <span class="detail-label">{{ item.label }}</span>
                    <span>{{ item.value }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="价格来源" width="120">
              <template #default="{ row }">
                <el-tag :type="row.sourceType" size="small">{{ row.sourceLabel }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openGroupDialog(row.group)">调整</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="`任务定价 (${taskRows.length})`" name="task">
          <p class="tab-tip text-muted">
            按任务类型配置灵工任务结算价，未单独配置的任务类型继承企业默认任务价格。
          </p>
          <el-table :data="taskRows" border stripe empty-text="该企业暂无任务类型">
            <el-table-column prop="taskType.name" label="任务类型" min-width="160" />
            <el-table-column prop="pricingLabel" label="任务类型定价" min-width="160" />
            <el-table-column prop="settlementLabel" label="当前任务结算价" width="140" />
            <el-table-column label="价格来源" width="120">
              <template #default="{ row }">
                <el-tag :type="row.sourceType" size="small">{{ row.sourceLabel }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="说明" min-width="220">
              <template #default="{ row }">
                <span v-if="row.pricingNote" class="text-muted">{{ row.pricingNote }}</span>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openTaskDialog(row.taskType)">调整</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>

  <el-dialog
    v-model="groupDialogVisible"
    :title="`工时结算价 · ${editingGroup?.name ?? ''}`"
    width="640px"
  >
    <el-form label-width="100px">
      <el-form-item label="价格策略">
        <el-radio-group v-model="groupForm.useEnterpriseDefault">
          <el-radio :value="true">使用企业默认价</el-radio>
          <el-radio :value="false">考勤组定制</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="是否日结">
        <el-switch v-model="groupForm.dailySettlement" active-text="日结" inactive-text="非日结" />
        <span class="field-hint">开启后，该考勤组灵工工时收入按日结算</span>
      </el-form-item>
      <SettlementHourlyRatesEditor v-if="!groupForm.useEnterpriseDefault" v-model="groupForm.hourly" />
      <el-alert v-else type="info" :closable="false" show-icon>
        将继承企业默认工时结算价（白班/夜班/加班/周末/节假日）
      </el-alert>
    </el-form>
    <template #footer>
      <el-button @click="groupDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveGroupOverride">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="taskDialogVisible"
    :title="`任务结算价 · ${editingTaskType?.name ?? ''}`"
    width="480px"
  >
    <el-form label-width="120px">
      <el-form-item label="价格策略">
        <el-radio-group v-model="taskForm.useEnterpriseDefault">
          <el-radio :value="true">使用企业默认价</el-radio>
          <el-radio :value="false">任务类型定制</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="!taskForm.useEnterpriseDefault" label="任务结算价">
        <el-input-number v-model="taskForm.unitPrice" :min="0" :precision="2" /> 元/单
      </el-form-item>
      <el-alert v-else type="info" :closable="false" show-icon>
        将使用企业默认任务结算价 ¥{{ enterpriseTaskUnitPrice }}/单
      </el-alert>
    </el-form>
    <template #footer>
      <el-button @click="taskDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveTaskOverride">保存</el-button>
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

.section-title {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
}

.tab-tip {
  margin: 0 0 12px;
  font-size: 13px;
}

.task-price-item {
  margin-top: 8px;
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
