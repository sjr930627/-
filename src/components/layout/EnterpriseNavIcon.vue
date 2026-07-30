<script setup lang="ts">
defineProps<{
  name: string
  active?: boolean
}>()
</script>

<template>
  <span class="nav-icon" :class="{ active }">
    <!-- 需求管理 -->
    <svg v-if="name === 'requirements'" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.4" />
      <path d="M6 6h8M6 10h8M6 14h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </svg>
    <!-- 招聘进度 -->
    <svg v-else-if="name === 'progress'" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.4" />
      <path d="M5 13l3-4 3 2 4-6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <!-- 人员 -->
    <svg v-else-if="name === 'personnel'" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3" stroke="currentColor" stroke-width="1.4" />
      <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </svg>
    <!-- 合同 -->
    <svg v-else-if="name === 'contract'" viewBox="0 0 20 20" fill="none">
      <path d="M5 3h7l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.4" />
      <path d="M12 3v4h4M7 10h6M7 13h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </svg>
    <!-- 考勤规则 -->
    <svg v-else-if="name === 'attendance-rule'" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.4" />
      <path d="M3 8h14M7 2v3M13 2v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="10" cy="12" r="2" fill="currentColor" opacity=".25" />
    </svg>
    <!-- 排班 -->
    <svg v-else-if="name === 'schedule'" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" stroke-width="1.4" />
      <path d="M2 8h16M6 2v3M14 2v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      <rect x="5" y="10" width="4" height="3" rx=".5" fill="currentColor" opacity=".3" />
      <rect x="11" y="10" width="4" height="3" rx=".5" fill="currentColor" opacity=".55" />
    </svg>
    <!-- 考勤记录 -->
    <svg v-else-if="name === 'attendance-record'" viewBox="0 0 20 20" fill="none">
      <path d="M4 4h12v12H4z" stroke="currentColor" stroke-width="1.4" rx="1" />
      <path d="M7 8h6M7 11h4M7 14h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="14" cy="6" r="2.5" fill="currentColor" opacity=".35" />
    </svg>
    <!-- 保险 -->
    <svg v-else-if="name === 'insurance'" viewBox="0 0 20 20" fill="none">
      <path d="M10 3l7 3v5c0 4.4-3 7.5-7 9-4-1.5-7-4.6-7-9V6l7-3z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
      <path d="M7.5 10l2 2 3.5-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <!-- 任务 -->
    <svg v-else-if="name === 'task'" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.4" />
      <path d="M7 10l2 2 5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <!-- 任务模板 -->
    <svg v-else-if="name === 'task-template'" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="11" height="13" rx="1.5" stroke="currentColor" stroke-width="1.4" />
      <rect x="7" y="2" width="11" height="13" rx="1.5" stroke="currentColor" stroke-width="1.4" fill="var(--nav-icon-bg, #fff)" />
      <path d="M10 6h5M10 9h5M10 12h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
    <!-- 账单 -->
    <svg v-else-if="name === 'bill'" viewBox="0 0 20 20" fill="none">
      <path d="M5 3h10a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.4" />
      <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="14" cy="14" r="2" fill="currentColor" opacity=".35" />
    </svg>
    <!-- 结算 -->
    <svg v-else-if="name === 'settlement'" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.4" />
      <path d="M10 6v4l3 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </svg>
    <!-- 计薪 -->
    <svg v-else-if="name === 'payroll-rule'" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.4" />
      <path d="M7 7h6M7 10h4M7 13h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      <path d="M13 12l2 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </svg>
    <!-- 发票 -->
    <svg v-else-if="name === 'invoice'" viewBox="0 0 20 20" fill="none">
      <path d="M6 3h8l3 3v11H6V3z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
      <path d="M14 3v3h3M8 10h5M8 13h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </svg>
    <!-- 帮助 -->
    <svg v-else-if="name === 'help'" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.4" />
      <path d="M8 8a2 2 0 013.2 1.5c0 1.5-2.2 1.3-2.2 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="10" cy="14.5" r=".8" fill="currentColor" />
    </svg>
    <!-- 工作台 -->
    <svg v-else viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4" />
    </svg>
  </span>
</template>

<style scoped>
.nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #64748b;
  background: #f1f5f9;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.nav-icon svg {
  width: 16px;
  height: 16px;
}

.nav-icon.active {
  color: #5b4fdb;
  background: linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%);
  box-shadow: inset 0 0 0 1px rgba(91, 79, 219, 0.12);
}
</style>
