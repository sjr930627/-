<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { BillImportFieldConfig } from '@/types'
import {
  billImportFieldTypeMap,
  createEmptyImportField,
  formatImportFieldConstraint,
  slugifyFieldKey,
  validateImportFields,
} from '@/constants/billImportTemplate'
import { downloadBillImportTemplate } from '@/services/billSettlement'
import { generateId } from '@/utils'

const fields = defineModel<BillImportFieldConfig[]>('fields', { required: true })

function addField() {
  fields.value.push(createEmptyImportField(generateId))
}

function removeField(index: number) {
  fields.value.splice(index, 1)
}

function onLabelBlur(row: BillImportFieldConfig) {
  if (!row.key.trim() && row.label.trim()) {
    row.key = slugifyFieldKey(row.label)
  }
  if (!row.columnHeader.trim() && row.label.trim()) {
    row.columnHeader = row.label.trim()
  }
}

function handleDownloadTemplate() {
  const error = validateImportFields(fields.value)
  if (error) {
    ElMessage.warning(error)
    return
  }
  downloadBillImportTemplate({ fields: fields.value })
  ElMessage.success('已按当前字段配置生成 Excel 模板')
}
</script>

<template>
  <div class="import-template-form">
    <div class="panel-section">
      <div class="section-head">
        <div>
          <span class="section-title">字段配置</span>
          <p class="section-hint">字段标识可在计薪规则公式中引用；结算逻辑请在计薪规则中配置</p>
        </div>
        <div class="head-actions">
          <el-button size="small" @click="addField">新增字段</el-button>
          <el-button link type="primary" @click="handleDownloadTemplate">下载 Excel 模板</el-button>
        </div>
      </div>
      <el-table :data="fields" border size="small" max-height="360">
        <el-table-column label="字段标识" min-width="130">
          <template #default="{ row }">
            <el-input v-model="row.key" size="small" placeholder="如 work_hours" @blur="onLabelBlur(row)" />
          </template>
        </el-table-column>
        <el-table-column label="字段名称" min-width="110">
          <template #default="{ row }">
            <el-input v-model="row.label" size="small" placeholder="如 出勤工时" @blur="onLabelBlur(row)" />
          </template>
        </el-table-column>
        <el-table-column label="Excel 列名" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.columnHeader" size="small" placeholder="表头列名" />
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-select v-model="row.dataType" size="small">
              <el-option
                v-for="(label, key) in billImportFieldTypeMap"
                :key="key"
                :label="label"
                :value="key"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="必填" width="60" align="center">
          <template #default="{ row }">
            <el-checkbox v-model="row.required" />
          </template>
        </el-table-column>
        <el-table-column label="取值要求" min-width="150">
          <template #default="{ row }">
            <template v-if="row.dataType === 'number'">
              <div class="constraint-inputs">
                <el-input-number
                  v-model="row.min"
                  size="small"
                  :controls="false"
                  placeholder="最小"
                  style="width: 72px"
                />
                <span>~</span>
                <el-input-number
                  v-model="row.max"
                  size="small"
                  :controls="false"
                  placeholder="最大"
                  style="width: 72px"
                />
              </div>
            </template>
            <span v-else class="constraint-text">{{ formatImportFieldConstraint(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" fixed="right">
          <template #default="{ $index }">
            <el-button link type="danger" @click="removeField($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.import-template-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-section {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.section-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.constraint-inputs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.constraint-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
