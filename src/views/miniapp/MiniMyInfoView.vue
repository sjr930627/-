<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'

const { employee, department, profileExt } = useMiniAppWorker()
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title">我的资料</div>
    </div>
    <div class="mini-page">
      <div class="mini-card">
        <div class="mini-card-title">基本信息</div>
        <div style="font-size: 14px; line-height: 2; color: #666">
          <div>姓名：{{ employee?.name }}</div>
          <div>工号：{{ employee?.employeeNo }}</div>
          <div>部门：{{ department?.name }}</div>
          <div>岗位：{{ employee?.position }}</div>
          <div>手机：{{ employee?.phone ?? '138****8821' }}</div>
          <div>入职：{{ employee?.hireDate }}</div>
        </div>
      </div>

      <div class="mini-card">
        <div class="mini-card-title">排班偏好</div>
        <div style="font-size: 13px; color: #666">
          <div v-if="employee?.preferredShiftIds.length">
            偏好班次：{{ employee.preferredShiftIds.length }} 个
          </div>
          <div v-if="employee?.unavailableDates.length">
            不可用日期：{{ employee.unavailableDates.join('、') }}
          </div>
          <div v-if="!employee?.preferredShiftIds.length && !employee?.unavailableDates.length">
            暂未设置偏好
          </div>
        </div>
      </div>

      <div class="mini-card">
        <div class="mini-card-title">技能标签</div>
        <div>
          <span v-for="s in employee?.skills ?? []" :key="s" class="mini-tag blue" style="margin: 0 4px 4px 0">{{ s }}</span>
        </div>
      </div>

      <div class="mini-card">
        <div class="mini-card-title">技能证书</div>
        <div v-for="(cert, i) in profileExt?.certificates ?? []" :key="i" style="padding: 8px 0; border-bottom: 1px solid #f5f5f5">
          <div style="font-size: 14px">{{ cert.name }}</div>
          <div style="font-size: 12px; color: #999">{{ cert.issuer }} · 有效期至 {{ cert.expireAt ?? '长期' }}</div>
        </div>
        <div v-if="!profileExt?.certificates.length" class="mini-empty" style="padding: 16px">暂无证书</div>
      </div>
    </div>
  </div>
</template>
