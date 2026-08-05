<script setup lang="ts">
import { pricingValueModeOptions } from '@/constants/attendanceGroupPricing'
import { createDefaultSettlementHourlyConfig } from '@/services/settlementPrice'
import type { SettlementHourlyConfig, VariablePriceConfig } from '@/types'

const model = defineModel<SettlementHourlyConfig>({ required: true })

const variableRows: { key: keyof Pick<SettlementHourlyConfig, 'overtime' | 'weekend' | 'holiday'>; label: string }[] = [
  { key: 'overtime', label: '加班工时' },
  { key: 'weekend', label: '周末工时' },
  { key: 'holiday', label: '节假日工时' },
]

function getVariableConfig(key: (typeof variableRows)[number]['key']) {
  return model.value[key]
}

function onVariableModeChange(config: VariablePriceConfig) {
  if (config.mode === 'fixed') {
    config.fixedAmount = config.fixedAmount ?? model.value.dayShiftRate
    config.multiplier = undefined
  } else {
    config.multiplier = config.multiplier ?? 1.5
    config.fixedAmount = undefined
  }
}

function ensureDefaults() {
  const defaults = createDefaultSettlementHourlyConfig(model.value.dayShiftRate)
  if (!model.value.overtime?.mode) model.value.overtime = defaults.overtime
  if (!model.value.weekend?.mode) model.value.weekend = defaults.weekend
  if (!model.value.holiday?.mode) model.value.holiday = defaults.holiday
}

ensureDefaults()
</script>

<template>
  <div class="hourly-rates-editor">
    <el-row :gutter="16">
      <el-col :span="12">
        <el-form-item label="白班工时价">
          <el-input-number v-model="model.dayShiftRate" :min="0" :precision="2" style="width: 100%" />
          <span class="field-unit">元/小时</span>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="夜班工时价">
          <el-input-number v-model="model.nightShiftRate" :min="0" :precision="2" style="width: 100%" />
          <span class="field-unit">元/小时</span>
        </el-form-item>
      </el-col>
    </el-row>

    <div class="variable-title">加班 / 周末 / 节假日工时</div>
    <el-table :data="variableRows" border size="small">
      <el-table-column prop="label" label="项目" width="120" />
      <el-table-column label="计价方式" width="200">
        <template #default="{ row }">
          <el-radio-group
            v-model="getVariableConfig(row.key).mode"
            size="small"
            @change="onVariableModeChange(getVariableConfig(row.key))"
          >
            <el-radio v-for="opt in pricingValueModeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </el-radio>
          </el-radio-group>
        </template>
      </el-table-column>
      <el-table-column label="配置值">
        <template #default="{ row }">
          <template v-if="getVariableConfig(row.key).mode === 'fixed'">
            <el-input-number
              v-model="getVariableConfig(row.key).fixedAmount"
              :min="0"
              :precision="2"
              size="small"
            />
            <span class="field-unit">元/小时</span>
          </template>
          <template v-else>
            <el-input-number
              v-model="getVariableConfig(row.key).multiplier"
              :min="0.1"
              :max="10"
              :step="0.1"
              :precision="1"
              size="small"
            />
            <span class="field-unit">倍（基于白班 ¥{{ model.dayShiftRate }}/h）</span>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.hourly-rates-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.variable-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-top: 4px;
}

.field-unit {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
