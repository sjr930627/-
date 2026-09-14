<script setup lang="ts">
import TaskFormSection from '@/components/task/TaskFormSection.vue'
import TaskQuantityField from '@/components/task/TaskQuantityField.vue'
import DepartmentLeafCascader from '@/components/employee/DepartmentLeafCascader.vue'
import {
  emptyTaskMetadataField,
  taskMetadataFieldTypeOptions,
} from '@/constants/task'
import { REGION_CASCADER_OPTIONS } from '@/constants/region'
import type {
  Department,
  TaskMetadataField,
  TaskMetadataFieldType,
  TaskPublishScope,
} from '@/types'

export interface TaskPublishFormModel {
  enterpriseId?: string
  serviceProviderId: string
  publishScope: TaskPublishScope
  /** 发布部门多选 */
  departmentIds: string[]
  workflowId: string
  name: string
  description: string
  regionCodes: string[]
  addressDetail: string
  metadataFields: TaskMetadataField[]
  fixedPrice: number
  settlementUnitPrice?: number
  trainingCourseId: string
  plannedTotal: number | undefined
  unlimitedQuantity: boolean
  longTerm: boolean
  dateRange: string[]
  maxPerPerson: number
}

const form = defineModel<TaskPublishFormModel>({ required: true })

withDefaults(
  defineProps<{
    readonly?: boolean
    showEnterprise?: boolean
    showSettlement?: boolean
    enterpriseOptions?: { label: string; value: string }[]
    providerOptions?: { label: string; value: string }[]
    departmentOptions: Department[]
    workflowOptions: { label: string; value: string }[]
    customerUnitPrice?: number
  }>(),
  {
    readonly: false,
    showEnterprise: false,
    showSettlement: false,
    enterpriseOptions: () => [],
    providerOptions: () => [],
    customerUnitPrice: 0,
  },
)

const emit = defineEmits<{
  'update:enterpriseId': [id: string]
  syncSettlement: []
}>()

function addMetadataField() {
  form.value.metadataFields.push(emptyTaskMetadataField(form.value.metadataFields.length))
}

function removeMetadataField(index: number) {
  form.value.metadataFields.splice(index, 1)
}

function onMetaTypeChange(item: TaskMetadataField, type: TaskMetadataFieldType) {
  item.type = type
  if (type === 'timeRange') {
    item.value = ''
    return
  }
  if (type === 'address' || type === 'time' || type === 'text') return
  // 文件/图片：值存文件名或说明即可
  if (!item.value) item.value = ''
}

function parseTimeRangeValue(value: string): [string, string] | undefined {
  const parts = value.split(/\s*~\s*/).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) return [parts[0], parts[1]]
  return undefined
}

function formatTimeRangeValue(range: [string, string] | null | undefined): string {
  if (!range?.[0] || !range?.[1]) return ''
  return `${range[0]} ~ ${range[1]}`
}

function getTimeRangeModel(item: TaskMetadataField): [string, string] | undefined {
  return parseTimeRangeValue(item.value)
}

function setTimeRangeModel(item: TaskMetadataField, range: [string, string] | null) {
  item.value = formatTimeRangeValue(range)
}
</script>

<template>
  <div class="task-publish-form-body">
    <TaskFormSection title="基本信息" subtitle="服务商、范围、流程与地点" icon="基" icon-variant="blue">
      <el-form-item v-if="showEnterprise" label="企业" required>
        <el-select
          :model-value="form.enterpriseId"
          filterable
          placeholder="选择企业"
          style="width: 100%"
          :disabled="readonly"
          @update:model-value="(v: string) => emit('update:enterpriseId', v)"
        >
          <el-option
            v-for="opt in enterpriseOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="服务商" required>
        <el-select
          v-model="form.serviceProviderId"
          filterable
          placeholder="选择合作服务商"
          style="width: 100%"
          :disabled="readonly"
        >
          <el-option
            v-for="opt in providerOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="发布范围" required>
        <el-radio-group v-model="form.publishScope" :disabled="readonly">
          <el-radio-button value="global">全局</el-radio-button>
          <el-radio-button value="department">部门</el-radio-button>
        </el-radio-group>
        <p class="field-hint">
          全局：所有灵工可见；部门：所选部门及其全部下级灵工可见
        </p>
      </el-form-item>

      <el-form-item v-if="form.publishScope === 'department'" label="发布部门" required>
        <DepartmentLeafCascader
          v-model="form.departmentIds"
          :departments="departmentOptions"
          multiple
          :leaf-only="false"
          :check-strictly="true"
          :allow-ids="form.departmentIds"
          :disabled="readonly"
          placeholder="可多选任意级部门（含子部门）"
        />
      </el-form-item>

      <el-form-item label="流程模板" required>
        <el-select
          v-model="form.workflowId"
          placeholder="选择已启用的流程"
          style="width: 100%"
          :disabled="readonly"
        >
          <el-option
            v-for="opt in workflowOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="任务名称" required>
        <el-input v-model="form.name" placeholder="默认：流程名+年月，可编辑" :disabled="readonly" />
      </el-form-item>

      <el-form-item label="任务内容" required>
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="对灵工展示的任务说明"
          :disabled="readonly"
        />
      </el-form-item>

      <el-form-item label="任务地点" required>
        <el-cascader
          v-model="form.regionCodes"
          :options="REGION_CASCADER_OPTIONS"
          :props="{ expandTrigger: 'hover' }"
          clearable
          filterable
          placeholder="请选择省 / 市 / 区"
          style="width: 100%"
          :disabled="readonly"
        />
      </el-form-item>
      <el-form-item label="详细地址">
        <el-input
          v-model="form.addressDetail"
          placeholder="选填，如道路门牌、楼层"
          :disabled="readonly"
        />
      </el-form-item>
    </TaskFormSection>

    <TaskFormSection
      title="任务元数据"
      subtitle="字段名称、类型与值（可选）"
      icon="元"
      icon-variant="orange"
    >
      <div v-if="form.metadataFields.length" class="metadata-list">
        <div v-for="(item, index) in form.metadataFields" :key="item.key" class="metadata-row">
          <el-input v-model="item.label" placeholder="字段名称" style="flex: 1.1" :disabled="readonly" />
          <el-select
            :model-value="item.type"
            placeholder="类型"
            style="width: 118px"
            :disabled="readonly"
            @update:model-value="(v: TaskMetadataFieldType) => onMetaTypeChange(item, v)"
          >
            <el-option
              v-for="opt in taskMetadataFieldTypeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <template v-if="item.type === 'time'">
            <el-date-picker
              v-model="item.value"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm"
              placeholder="选择时间"
              style="flex: 1.4"
              :disabled="readonly"
            />
          </template>
          <template v-else-if="item.type === 'timeRange'">
            <el-date-picker
              :model-value="getTimeRangeModel(item)"
              type="datetimerange"
              value-format="YYYY-MM-DD HH:mm"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              style="flex: 1.8; min-width: 280px"
              :disabled="readonly"
              @update:model-value="(v: [string, string] | null) => setTimeRangeModel(item, v)"
            />
          </template>
          <template v-else-if="item.type === 'address'">
            <el-input
              v-model="item.value"
              placeholder="地址内容"
              style="flex: 1.4"
              :disabled="readonly"
            />
          </template>
          <template v-else-if="item.type === 'file' || item.type === 'image'">
            <el-input
              v-model="item.value"
              :placeholder="item.type === 'image' ? '图片说明或链接' : '文件说明或链接'"
              style="flex: 1.4"
              :disabled="readonly"
            />
          </template>
          <template v-else>
            <el-input
              v-model="item.value"
              placeholder="字段值"
              style="flex: 1.4"
              :disabled="readonly"
            />
          </template>
          <el-button v-if="!readonly" text type="danger" @click="removeMetadataField(index)">
            删除
          </el-button>
        </div>
      </div>
      <p v-else class="field-hint">暂无自定义字段</p>
      <el-button v-if="!readonly" size="small" @click="addMetadataField">添加字段</el-button>
    </TaskFormSection>

    <TaskFormSection title="定价配置" subtitle="固定单价" icon="价" icon-variant="green">
      <el-form-item label="固定单价" required>
        <el-input-number v-model="form.fixedPrice" :min="1" :max="9999" :disabled="readonly" />
        元/单
      </el-form-item>
      <el-form-item v-if="showSettlement" label="结算单价" required>
        <div class="settlement-row">
          <el-input-number
            v-model="form.settlementUnitPrice"
            :min="0"
            :max="9999"
            :step="1"
            :disabled="readonly"
          />
          <span>元/单</span>
          <el-button v-if="!readonly" link type="primary" @click="emit('syncSettlement')">
            同步客户单价（¥{{ customerUnitPrice }}）
          </el-button>
        </div>
        <p class="field-hint">灵工认领结算按此单价；客户费用按上方固定单价</p>
      </el-form-item>
      <el-form-item label="培训要求">
        <el-input
          v-model="form.trainingCourseId"
          placeholder="可选，关联培训课程 ID"
          :disabled="readonly"
        />
      </el-form-item>
    </TaskFormSection>

    <TaskFormSection title="数量与期限" subtitle="数量必填，期限可选长期" icon="量" icon-variant="purple">
      <el-form-item label="任务数量" required>
        <TaskQuantityField
          v-model="form.plannedTotal"
          v-model:unlimited="form.unlimitedQuantity"
          :disabled="readonly"
        />
      </el-form-item>
      <el-form-item label="任务期限">
        <el-radio-group v-model="form.longTerm" :disabled="readonly">
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
          :disabled="readonly"
        />
      </el-form-item>
      <el-form-item label="限领规则">
        <span>每人最多</span>
        <el-input-number
          v-model="form.maxPerPerson"
          :min="1"
          :max="99"
          style="margin: 0 8px"
          :disabled="readonly"
        />
        <span>单</span>
      </el-form-item>
    </TaskFormSection>
  </div>
</template>

<style scoped>
.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.metadata-list {
  width: 100%;
  margin-bottom: 8px;
}

.metadata-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.settlement-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
