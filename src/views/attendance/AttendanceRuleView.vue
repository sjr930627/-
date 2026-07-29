<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import type { AttendanceRule } from '@/types'

const store = useAppStore()
const form = ref<AttendanceRule>({ ...store.attendanceRule })

function save() {
  store.updateAttendanceRule(form.value)
  ElMessage.success('打卡规则已保存')
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">打卡规则</h2>
        <p class="text-muted">配置弹性打卡、定位校验与补卡限制</p>
      </div>
      <el-button type="primary" @click="save">保存</el-button>
    </div>

    <el-form label-width="160px" style="max-width: 640px">
      <el-form-item label="上班弹性(迟到容忍)">
        <el-input-number v-model="form.flexMinutesAfter" :min="0" :max="60" /> 分钟
      </el-form-item>
      <el-form-item label="下班弹性(早退容忍)">
        <el-input-number v-model="form.flexMinutesBefore" :min="0" :max="60" /> 分钟
      </el-form-item>
      <el-form-item label="启用定位校验">
        <el-switch v-model="form.requireLocation" />
      </el-form-item>
      <el-form-item label="允许打卡半径">
        <el-input-number v-model="form.allowedRadiusMeters" :min="100" :max="5000" :step="100" /> 米
      </el-form-item>
      <el-form-item label="每月补卡上限">
        <el-input-number v-model="form.maxMakeupPerMonth" :min="1" :max="20" /> 次
      </el-form-item>
    </el-form>
  </div>
</template>
