<script setup lang="ts">
import { computed } from 'vue'
import type { WorkflowFieldConfig } from '@/types'
import { workflowFieldTypeMap } from '@/constants/task'

const props = defineProps<{
  fields: WorkflowFieldConfig[]
  previewNodeId?: string
  nodeLabel?: string
}>()

const visibleFields = computed(() =>
  props.fields
    .filter((f) => f.name.trim())
    .filter((f) => {
      if (!props.previewNodeId) return true
      if (!f.nodeIds.length) return true
      return f.nodeIds.includes(props.previewNodeId)
    }),
)
</script>

<template>
  <div class="field-preview">
    <div class="preview-header">
      <span class="preview-title">页面字段预览</span>
      <span v-if="nodeLabel" class="preview-node">{{ nodeLabel }}</span>
    </div>
    <div class="preview-device">
      <div class="preview-status-bar">
        <span>9:41</span>
        <span>任务填报</span>
        <span>100%</span>
      </div>
      <div class="preview-body">
        <div v-if="visibleFields.length" class="preview-form">
          <div v-for="field in visibleFields" :key="field.id" class="preview-field">
            <label class="field-label">
              {{ field.name }}
              <span v-if="field.required" class="required">*</span>
              <span class="field-type">{{ workflowFieldTypeMap[field.fieldType] }}</span>
            </label>
            <div class="field-control" :class="`type-${field.fieldType}`">
              <template v-if="field.fieldType === 'textarea'">
                <div class="mock-textarea">请输入{{ field.name }}</div>
              </template>
              <template v-else-if="field.fieldType === 'select'">
                <div class="mock-select">
                  {{ field.options?.[0] ?? `请选择${field.name}` }}
                  <span class="mock-arrow">▼</span>
                </div>
              </template>
              <template v-else-if="field.fieldType === 'switch'">
                <div class="mock-switch"><span class="mock-switch-knob" /></div>
              </template>
              <template v-else-if="field.fieldType === 'attachment'">
                <div class="mock-upload">+ 上传附件</div>
              </template>
              <template v-else-if="field.fieldType === 'date'">
                <div class="mock-input">请选择日期</div>
              </template>
              <template v-else-if="field.fieldType === 'amount'">
                <div class="mock-input mock-amount">¥ 0.00</div>
              </template>
              <template v-else>
                <div class="mock-input">请输入{{ field.name }}</div>
              </template>
            </div>
          </div>
          <el-button type="primary" class="preview-submit" disabled>提交</el-button>
        </div>
        <div v-else class="preview-empty">当前节点暂无下发字段</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.field-preview {
  margin-top: 12px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.preview-node {
  font-size: 12px;
  color: #909399;
}

.preview-device {
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  overflow: hidden;
  background: #f5f7fa;
}

.preview-status-bar {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 11px;
  color: #606266;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.preview-body {
  padding: 12px;
  min-height: 180px;
}

.preview-form {
  background: #fff;
  border-radius: 8px;
  padding: 12px;
}

.preview-field {
  margin-bottom: 12px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #303133;
  margin-bottom: 6px;
}

.required {
  color: #f56c6c;
}

.field-type {
  margin-left: auto;
  font-size: 11px;
  color: #909399;
  font-weight: normal;
}

.mock-input,
.mock-select,
.mock-textarea,
.mock-upload {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  color: #a8abb2;
  background: #fafafa;
}

.mock-textarea {
  min-height: 56px;
}

.mock-select {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mock-arrow {
  font-size: 10px;
}

.mock-amount {
  color: #606266;
}

.mock-upload {
  text-align: center;
  border-style: dashed;
  color: #409eff;
  background: #ecf5ff;
}

.mock-switch {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: #409eff;
  position: relative;
}

.mock-switch-knob {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
}

.preview-submit {
  width: 100%;
  margin-top: 4px;
}

.preview-empty {
  text-align: center;
  color: #909399;
  font-size: 13px;
  padding: 32px 12px;
  background: #fff;
  border-radius: 8px;
}
</style>
