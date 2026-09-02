<script setup lang="ts">
import { computed } from 'vue'
import type { WorkflowFieldConfig, WorkflowRole } from '@/types'
import { workflowFieldTypeMap } from '@/constants/task'

const props = withDefaults(
  defineProps<{
    fields: WorkflowFieldConfig[]
    previewNodeId?: string
    nodeLabel?: string
    nodeRole?: WorkflowRole
    compact?: boolean
  }>(),
  { compact: false, nodeRole: 'worker' },
)

const isEnterpriseDialog = computed(() => props.nodeRole === 'enterprise')
const previewTitle = computed(() => (isEnterpriseDialog.value ? '弹窗预览' : '填报预览'))
const dialogTitle = computed(() => `企业操作 · ${props.nodeLabel || '当前节点'}`)

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
  <div class="field-preview" :class="{ compact, enterprise: isEnterpriseDialog }">
    <div class="preview-header">
      <span class="preview-title">{{ previewTitle }}</span>
      <span v-if="nodeLabel" class="preview-node">{{ nodeLabel }}</span>
    </div>

    <div v-if="isEnterpriseDialog" class="preview-enterprise-stage">
      <div class="preview-backdrop" />
      <div class="preview-dialog">
        <div class="dialog-header">
          <div>
            <h4>{{ dialogTitle }}</h4>
            <p class="dialog-sub">企业端操作弹窗 · 填写采集字段后执行</p>
          </div>
          <span class="dialog-close">×</span>
        </div>
        <div class="dialog-body">
          <p v-if="visibleFields.length" class="dialog-tip">
            请填写以下信息后，点击底部按钮完成「{{ nodeLabel || '当前节点' }}」操作
          </p>
          <div v-if="visibleFields.length" class="preview-form dialog-form">
            <div v-for="field in visibleFields" :key="field.id" class="preview-field">
              <label class="field-label">
                {{ field.name }}
                <span v-if="field.required" class="required">*</span>
                <span class="field-type">{{ workflowFieldTypeMap[field.fieldType] }}</span>
              </label>
              <div class="field-control" :class="`type-${field.fieldType}`">
                <div v-if="field.fieldType === 'textarea'" class="mock-textarea">请输入{{ field.name }}</div>
                <template v-else-if="field.fieldType === 'select'">
                  <div class="mock-select">
                    {{ field.options?.[0] ?? `请选择${field.name}` }}
                    <span class="mock-arrow">▼</span>
                  </div>
                  <p v-if="field.options?.length" class="mock-options-hint">
                    共 {{ field.options.length }} 个选项
                  </p>
                </template>
                <div v-else-if="field.fieldType === 'switch'" class="mock-switch-row">
                  <span class="mock-switch-label">{{ field.name }}</span>
                  <div class="mock-switch"><span class="mock-switch-knob" /></div>
                </div>
                <div v-else-if="field.fieldType === 'attachment'" class="mock-upload">
                  + 上传{{ field.name }}
                </div>
                <div v-else-if="field.fieldType === 'date'" class="mock-input">请选择{{ field.name }}</div>
                <div v-else-if="field.fieldType === 'amount'" class="mock-input mock-amount">¥ 0.00</div>
                <div v-else class="mock-input">请输入{{ field.name }}</div>
              </div>
            </div>
          </div>
          <div v-else class="preview-empty dialog-empty">填写字段名称后将在此预览企业端弹窗效果</div>
        </div>
        <div class="dialog-footer">
          <el-button size="small" disabled>取消</el-button>
          <el-button type="primary" size="small" disabled>确认提交</el-button>
        </div>
      </div>
    </div>

    <div v-else class="preview-device">
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
              <div v-if="field.fieldType === 'textarea'" class="mock-textarea">请输入{{ field.name }}</div>
              <template v-else-if="field.fieldType === 'select'">
                <div class="mock-select">
                  {{ field.options?.[0] ?? `请选择${field.name}` }}
                  <span class="mock-arrow">▼</span>
                </div>
                <p v-if="field.options?.length" class="mock-options-hint">
                  共 {{ field.options.length }} 个选项
                </p>
              </template>
              <div v-else-if="field.fieldType === 'switch'" class="mock-switch-row">
                <span class="mock-switch-label">{{ field.name }}</span>
                <div class="mock-switch"><span class="mock-switch-knob" /></div>
              </div>
              <div v-else-if="field.fieldType === 'attachment'" class="mock-upload">
                + 上传{{ field.name }}
              </div>
              <div v-else-if="field.fieldType === 'date'" class="mock-input">请选择{{ field.name }}</div>
              <div v-else-if="field.fieldType === 'amount'" class="mock-input mock-amount">¥ 0.00</div>
              <div v-else class="mock-input">请输入{{ field.name }}</div>
            </div>
          </div>
          <el-button type="primary" class="preview-submit" disabled>提交</el-button>
        </div>
        <div v-else class="preview-empty">填写字段名称后将在此预览灵工端展示效果</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.field-preview {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed #ebeef5;
}

.field-preview.compact .preview-body,
.field-preview.compact .preview-enterprise-stage {
  min-height: 140px;
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

.preview-enterprise-stage {
  position: relative;
  min-height: 260px;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  overflow: hidden;
  background: #eef2f6;
}

.preview-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
}

.preview-dialog {
  position: relative;
  z-index: 1;
  width: calc(100% - 24px);
  max-width: 320px;
  margin: 28px auto 16px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #ebeef5;
  background: linear-gradient(180deg, #fafbfc, #fff);
}

.dialog-header h4 {
  margin: 0;
  font-size: 14px;
  color: #303133;
}

.dialog-sub {
  margin: 4px 0 0;
  font-size: 11px;
  color: #909399;
}

.dialog-close {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 16px;
  line-height: 1;
  background: #f5f7fa;
}

.dialog-body {
  padding: 12px 14px;
  max-height: 220px;
  overflow: auto;
}

.dialog-tip {
  margin: 0 0 10px;
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
}

.dialog-form {
  padding: 0;
  background: transparent;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px 12px;
  border-top: 1px solid #ebeef5;
  background: #fafafa;
}

.dialog-empty {
  padding: 24px 8px;
  background: transparent;
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

.mock-options-hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: #909399;
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

.mock-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.mock-switch-label {
  font-size: 13px;
  color: #606266;
}

.mock-switch {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: #409eff;
  position: relative;
  flex-shrink: 0;
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
