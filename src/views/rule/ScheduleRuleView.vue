<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import type { ScheduleRule } from '@/types'

const store = useAppStore()

const form = ref<ScheduleRule>({ ...store.scheduleRule })

function save() {
  store.updateScheduleRule(form.value)
  ElMessage.success('排班规则已保存')
}

function reset() {
  form.value = { ...store.scheduleRule }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">排班规则</h2>
        <p class="text-muted">配置硬约束规则，排班表将自动检测违规项</p>
      </div>
      <el-space>
        <el-button @click="reset">重置</el-button>
        <el-button type="primary" @click="save">保存规则</el-button>
      </el-space>
    </div>

    <el-form label-width="160px" style="max-width: 640px">
      <el-divider content-position="left">工时限制</el-divider>
      <el-form-item label="日排班工时上限">
        <el-input-number v-model="form.maxDailyHours" :min="1" :max="24" /> 小时
      </el-form-item>
      <el-form-item label="周排班工时上限">
        <el-input-number v-model="form.maxWeeklyHours" :min="1" :max="168" /> 小时
      </el-form-item>
      <el-form-item label="月排班工时上限">
        <el-input-number v-model="form.maxMonthlyHours" :min="1" :max="744" /> 小时
      </el-form-item>
      <el-form-item label="最少休息间隔">
        <el-input-number v-model="form.minRestHours" :min="8" :max="24" /> 小时
      </el-form-item>

      <el-divider content-position="left">连续性与休假</el-divider>
      <el-form-item label="最大连续上班天数">
        <el-input-number v-model="form.maxConsecutiveDays" :min="1" :max="14" /> 天
      </el-form-item>
      <el-form-item label="周末是否排班">
        <el-switch v-model="form.weekendWork" active-text="允许" inactive-text="默认休息" />
      </el-form-item>

      <el-divider content-position="left">特殊限制</el-divider>
      <el-form-item label="禁止女职工晚班">
        <el-switch v-model="form.forbidNightShiftForFemale" />
        <span class="text-muted" style="margin-left: 8px">Phase 2 完善性别字段后生效</span>
      </el-form-item>
    </el-form>

    <el-alert type="warning" :closable="false" style="margin-top: 16px">
      <template #title>合规说明</template>
      当前版本已实现连续上班、日/周工时、休息日排班等基础校验。完整劳动法合规检测将在 Phase 2 扩展。
    </el-alert>
  </div>
</template>
