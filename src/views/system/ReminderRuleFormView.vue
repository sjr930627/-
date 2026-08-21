<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  createEmptyCondition,
  reminderChannelOptions,
  reminderConditionFieldOptions,
  reminderConditionLogicOptions,
  reminderDataSourceOptions,
  reminderLevelOptions,
  reminderOperatorOptions,
  reminderReceiverModeOptions,
  reminderRoleOptions,
  reminderSceneOptions,
  reminderTriggerModeOptions,
  reminderTriggerTargetOptions,
  reminderUnitOptions,
} from '@/constants/reminderRule'
import type {
  ReminderChannel,
  ReminderCondition,
  ReminderConditionLogic,
  ReminderLevel,
  ReminderReceiverMode,
  ReminderSceneCategory,
  ReminderTriggerMode,
} from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const ruleId = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => route.name === 'ReminderRuleEdit' && !!ruleId.value)

const form = ref({
  name: '',
  scene: 'attendance' as ReminderSceneCategory,
  description: '',
  triggerTarget: 'schedule_assignment',
  dataSource: 'attendance_punch',
  conditions: [createEmptyCondition(`c_${Date.now()}`)] as ReminderCondition[],
  titleTemplate: '',
  contentTemplate: '',
  level: 'important' as ReminderLevel,
  channels: ['todo', 'inbox'] as ReminderChannel[],
  receiverMode: 'dynamic' as ReminderReceiverMode,
  receiverRole: 'worker',
  ccRole: '',
  dynamicMatchHint: '触发对象关联的灵工 → 推送给本人；关联考勤组主管 → 抄送',
  triggerMode: 'realtime' as ReminderTriggerMode,
  scheduleTime: '10:00',
  delayMinutes: 30,
  quietStart: '22:00',
  quietEnd: '08:00',
  rateLimitHours: 24,
  rateLimitCount: 3,
  enterpriseIds: [] as string[],
  attendanceGroupIds: [] as string[],
  applyAllEnterprises: true,
  applyAllGroups: true,
  effectiveFrom: '2026-08-01',
  effectiveTo: '2026-12-31',
  status: 'active' as 'active' | 'disabled',
})

watch(
  () => [isEdit.value, ruleId.value, store.reminderRules] as const,
  () => {
    if (!isEdit.value || !ruleId.value) return
    const rule = store.reminderRules.find((r) => r.id === ruleId.value)
    if (!rule) return
    form.value = {
      name: rule.name,
      scene: rule.scene,
      description: rule.description ?? '',
      triggerTarget: rule.triggerTarget,
      dataSource: rule.dataSource,
      conditions: rule.conditions.length
        ? rule.conditions.map((c, idx) => ({
            ...c,
            logic: (idx === 0 ? 'and' : c.logic || 'and') as ReminderConditionLogic,
            unit: c.unit ?? '',
          }))
        : [createEmptyCondition(`c_${Date.now()}`)],
      titleTemplate: rule.titleTemplate,
      contentTemplate: rule.contentTemplate,
      level: rule.level,
      channels: [...rule.channels],
      receiverMode: rule.receiverMode,
      receiverRole: rule.receiverRole ?? 'worker',
      ccRole: rule.ccRole ?? '',
      dynamicMatchHint: rule.dynamicMatchHint ?? '',
      triggerMode: rule.triggerMode,
      scheduleTime: rule.scheduleTime ?? '10:00',
      delayMinutes: rule.delayMinutes ?? 30,
      quietStart: rule.quietStart ?? '22:00',
      quietEnd: rule.quietEnd ?? '08:00',
      rateLimitHours: rule.rateLimitHours,
      rateLimitCount: rule.rateLimitCount,
      enterpriseIds: [...rule.enterpriseIds],
      attendanceGroupIds: [...rule.attendanceGroupIds],
      applyAllEnterprises: !rule.enterpriseIds.length,
      applyAllGroups: !rule.attendanceGroupIds.length,
      effectiveFrom: rule.effectiveFrom ?? '',
      effectiveTo: rule.effectiveTo ?? '',
      status: rule.status,
    }
  },
  { immediate: true },
)

const groupOptions = computed(() =>
  store.attendanceGroups.map((g) => ({
    value: g.id,
    label: g.name,
  })),
)

function addCondition(logic: ReminderConditionLogic = 'and') {
  form.value.conditions.push(
    createEmptyCondition(`c_${Date.now()}_${form.value.conditions.length}`, logic),
  )
}

function removeCondition(id: string) {
  if (form.value.conditions.length <= 1) {
    ElMessage.warning('至少保留一条条件')
    return
  }
  form.value.conditions = form.value.conditions.filter((c) => c.id !== id)
}

function resetConditions() {
  form.value.conditions = [createEmptyCondition(`c_${Date.now()}`)]
}

function cancel() {
  router.push('/system/reminder-rules')
}

function save() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写规则名称')
    return
  }
  if (!form.value.titleTemplate.trim() || !form.value.contentTemplate.trim()) {
    ElMessage.warning('请填写提醒标题与内容')
    return
  }
  if (!form.value.channels.length) {
    ElMessage.warning('请至少选择一种提醒方式')
    return
  }
  if (form.value.conditions.some((c) => !c.field || !c.value.trim())) {
    ElMessage.warning('请完整填写触发条件')
    return
  }

  const payload = {
    name: form.value.name.trim(),
    scene: form.value.scene,
    description: form.value.description.trim() || undefined,
    triggerTarget: form.value.triggerTarget,
    dataSource: form.value.dataSource,
    conditions: form.value.conditions.map((c, idx) => ({
      ...c,
      value: c.value.trim(),
      unit: c.unit || undefined,
      logic: (idx === 0 ? undefined : c.logic === 'or' ? 'or' : 'and') as
        | import('@/types').ReminderConditionLogic
        | undefined,
    })),
    titleTemplate: form.value.titleTemplate.trim(),
    contentTemplate: form.value.contentTemplate.trim(),
    level: form.value.level,
    channels: [...form.value.channels],
    receiverMode: form.value.receiverMode,
    receiverRole: form.value.receiverRole || undefined,
    ccRole: form.value.ccRole || undefined,
    dynamicMatchHint:
      form.value.receiverMode === 'dynamic'
        ? form.value.dynamicMatchHint.trim() || undefined
        : undefined,
    triggerMode: form.value.triggerMode,
    scheduleTime: form.value.triggerMode === 'scheduled' ? form.value.scheduleTime : undefined,
    delayMinutes: form.value.triggerMode === 'delayed' ? form.value.delayMinutes : undefined,
    quietStart: form.value.quietStart || undefined,
    quietEnd: form.value.quietEnd || undefined,
    rateLimitHours: form.value.rateLimitHours,
    rateLimitCount: form.value.rateLimitCount,
    enterpriseIds: form.value.applyAllEnterprises ? [] : [...form.value.enterpriseIds],
    attendanceGroupIds: form.value.applyAllGroups ? [] : [...form.value.attendanceGroupIds],
    effectiveFrom: form.value.effectiveFrom || undefined,
    effectiveTo: form.value.effectiveTo || undefined,
    status: form.value.status,
  }

  if (isEdit.value && ruleId.value) {
    store.updateReminderRule(ruleId.value, payload)
    ElMessage.success('规则已更新')
  } else {
    store.addReminderRule(payload)
    ElMessage.success('规则已保存并生效')
  }
  router.push('/system/reminder-rules')
}
</script>

<template>
  <div class="rule-form-page">
    <div class="page-breadcrumb-row">
      <el-breadcrumb separator=">">
        <el-breadcrumb-item>系统设置</el-breadcrumb-item>
        <el-breadcrumb-item>
          <a @click.prevent="cancel">提醒规则配置</a>
        </el-breadcrumb-item>
        <el-breadcrumb-item>{{ isEdit ? '编辑提醒规则' : '新建提醒规则' }}</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="header-actions">
        <el-button @click="cancel">取消</el-button>
        <el-button type="primary" @click="save">保存并生效</el-button>
      </div>
    </div>

    <section class="page-card form-section">
      <h3 class="section-title">1. 基本信息</h3>
      <el-form label-width="100px" class="form-grid">
        <el-form-item label="规则名称" required>
          <el-input v-model="form.name" placeholder="如：上班未打卡提醒" maxlength="40" show-word-limit />
        </el-form-item>
        <el-form-item label="提醒场景" required>
          <el-select v-model="form.scene" style="width: 100%">
            <el-option
              v-for="opt in reminderSceneOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="规则说明" class="full">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="说明规则用途与触发时机"
          />
        </el-form-item>
      </el-form>
    </section>

    <section class="page-card form-section">
      <h3 class="section-title">2. 触发条件配置</h3>
      <el-form label-width="100px" class="form-grid">
        <el-form-item label="触发对象">
          <el-select v-model="form.triggerTarget" style="width: 100%">
            <el-option
              v-for="opt in reminderTriggerTargetOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数据来源">
          <el-select v-model="form.dataSource" style="width: 100%">
            <el-option
              v-for="opt in reminderDataSourceOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <div class="condition-box">
        <div class="condition-label-row">
          <div class="condition-label">条件组合</div>
          <div class="condition-hint">多条件可选用「且 / 或」连接，按从左到右顺序匹配</div>
        </div>
        <div v-for="(cond, idx) in form.conditions" :key="cond.id" class="condition-row">
          <span v-if="idx === 0" class="cond-prefix">当</span>
          <el-select
            v-else
            v-model="cond.logic"
            class="logic-select"
            style="width: 88px"
          >
            <el-option
              v-for="opt in reminderConditionLogicOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            >
              <span>{{ opt.label }}</span>
              <span class="logic-option-desc">{{ opt.desc }}</span>
            </el-option>
          </el-select>
          <el-select v-model="cond.field" style="width: 220px">
            <el-option
              v-for="opt in reminderConditionFieldOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <el-select v-model="cond.operator" style="width: 90px">
            <el-option
              v-for="opt in reminderOperatorOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <el-input v-model="cond.value" placeholder="值" style="width: 140px" />
          <el-select v-model="cond.unit" style="width: 100px">
            <el-option
              v-for="opt in reminderUnitOptions"
              :key="opt.value || 'none'"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <el-button link type="danger" @click="removeCondition(cond.id)">删除</el-button>
        </div>
        <div class="condition-actions">
          <el-button @click="addCondition('and')">+ 且条件</el-button>
          <el-button @click="addCondition('or')">+ 或条件</el-button>
          <el-button text @click="resetConditions">重置</el-button>
        </div>
      </div>
    </section>

    <section class="page-card form-section">
      <h3 class="section-title">3. 提醒配置</h3>
      <el-form label-width="100px">
        <el-form-item label="提醒标题" required>
          <el-input
            v-model="form.titleTemplate"
            placeholder="支持变量，如：上班未打卡提醒：{灵工姓名} {日期} {班次}"
          />
        </el-form-item>
        <el-form-item label="提醒内容" required>
          <el-input
            v-model="form.contentTemplate"
            type="textarea"
            :rows="3"
            placeholder="支持变量，如：您在 {班次开始时间} 的 {班次名称} 尚未打卡，请及时打卡。"
          />
        </el-form-item>
        <el-form-item label="提醒等级">
          <el-select v-model="form.level" style="width: 200px">
            <el-option
              v-for="opt in reminderLevelOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="提醒方式">
          <el-checkbox-group v-model="form.channels">
            <el-checkbox
              v-for="opt in reminderChannelOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
    </section>

    <section class="page-card form-section">
      <h3 class="section-title">4. 接收人配置</h3>
      <el-form label-width="100px" class="form-grid">
        <el-form-item label="接收方式">
          <el-select v-model="form.receiverMode" style="width: 100%">
            <el-option
              v-for="opt in reminderReceiverModeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="接收角色">
          <el-select v-model="form.receiverRole" style="width: 100%">
            <el-option
              v-for="opt in reminderRoleOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="抄送角色">
          <el-select v-model="form.ccRole" clearable placeholder="可选" style="width: 100%">
            <el-option
              v-for="opt in reminderRoleOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.receiverMode === 'dynamic'" label="动态匹配" class="full">
          <el-input
            v-model="form.dynamicMatchHint"
            type="textarea"
            :rows="2"
            placeholder="描述动态匹配规则"
          />
        </el-form-item>
      </el-form>
    </section>

    <section class="page-card form-section">
      <h3 class="section-title">5. 触发时间</h3>
      <el-form label-width="100px" class="form-grid">
        <el-form-item label="触发时间">
          <el-select v-model="form.triggerMode" style="width: 100%">
            <el-option
              v-for="opt in reminderTriggerModeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.triggerMode === 'scheduled'" label="每日时间">
          <el-time-select
            v-model="form.scheduleTime"
            start="00:00"
            step="00:30"
            end="23:30"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item v-if="form.triggerMode === 'delayed'" label="延时分钟">
          <el-input-number v-model="form.delayMinutes" :min="1" :max="1440" />
        </el-form-item>
        <el-form-item label="免打扰">
          <div class="inline-range">
            <el-time-select
              v-model="form.quietStart"
              start="00:00"
              step="00:30"
              end="23:30"
              placeholder="开始"
            />
            <span>至</span>
            <el-time-select
              v-model="form.quietEnd"
              start="00:00"
              step="00:30"
              end="23:30"
              placeholder="结束"
            />
          </div>
        </el-form-item>
        <el-form-item label="触发频控" class="full">
          <div class="inline-range">
            <span>每</span>
            <el-input-number v-model="form.rateLimitHours" :min="1" :max="168" />
            <span>小时内最多触发</span>
            <el-input-number v-model="form.rateLimitCount" :min="1" :max="50" />
            <span>次</span>
          </div>
        </el-form-item>
      </el-form>
    </section>

    <section class="page-card form-section">
      <h3 class="section-title">6. 生效范围</h3>
      <el-form label-width="100px" class="form-grid">
        <el-form-item label="适用企业">
          <div class="scope-block">
            <el-switch v-model="form.applyAllEnterprises" active-text="全部企业" />
            <el-select
              v-if="!form.applyAllEnterprises"
              v-model="form.enterpriseIds"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              placeholder="指定企业"
              style="width: 100%; margin-top: 8px"
            >
              <el-option
                v-for="ent in store.enterprises"
                :key="ent.id"
                :label="ent.name"
                :value="ent.id"
              />
            </el-select>
          </div>
        </el-form-item>
        <el-form-item label="适用考勤组">
          <div class="scope-block">
            <el-switch v-model="form.applyAllGroups" active-text="全部考勤组" />
            <el-select
              v-if="!form.applyAllGroups"
              v-model="form.attendanceGroupIds"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              placeholder="指定考勤组"
              style="width: 100%; margin-top: 8px"
            >
              <el-option
                v-for="g in groupOptions"
                :key="g.value"
                :label="g.label"
                :value="g.value"
              />
            </el-select>
          </div>
        </el-form-item>
        <el-form-item label="生效时间" class="full">
          <div class="inline-range">
            <el-date-picker
              v-model="form.effectiveFrom"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="开始日期"
            />
            <span>至</span>
            <el-date-picker
              v-model="form.effectiveTo"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="结束日期"
            />
          </div>
        </el-form-item>
        <el-form-item label="初始状态">
          <el-radio-group v-model="form.status">
            <el-radio value="active">保存并生效</el-radio>
            <el-radio value="disabled">保存为停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </section>

    <div class="footer-actions">
      <el-button @click="cancel">取消</el-button>
      <el-button type="primary" @click="save">保存并生效</el-button>
    </div>
  </div>
</template>

<style scoped>
.rule-form-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-breadcrumb-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.header-actions,
.footer-actions {
  display: flex;
  gap: 8px;
}

.footer-actions {
  justify-content: flex-end;
  padding: 4px 0 12px;
}

.form-section {
  padding: 18px 20px 8px;
}

.section-title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 650;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.form-grid :deep(.full) {
  grid-column: 1 / -1;
}

.condition-box {
  margin: 4px 0 16px;
  padding: 14px;
  background: #f7f8fa;
  border-radius: 10px;
}

.condition-label-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}

.condition-label {
  font-size: 13px;
  color: #606266;
}

.condition-hint {
  font-size: 12px;
  color: #909399;
}

.condition-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.cond-prefix {
  width: 88px;
  color: #909399;
  font-size: 13px;
  text-align: center;
}

.logic-option-desc {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}

.condition-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.inline-range {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.scope-block {
  width: 100%;
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
