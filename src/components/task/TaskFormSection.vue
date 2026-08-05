<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    icon?: string
    iconVariant?: 'blue' | 'green' | 'orange' | 'purple'
  }>(),
  { iconVariant: 'blue' },
)
</script>

<template>
  <section class="task-form-section">
    <div class="section-head">
      <div class="section-icon" :class="`section-icon--${iconVariant}`">
        {{ icon ?? title.slice(0, 1) }}
      </div>
      <div class="section-head-text">
        <h4>{{ title }}</h4>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
    </div>
    <div class="section-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.task-form-section {
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 14px;
}

.task-form-section:last-child {
  margin-bottom: 0;
}

.section-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 14px;
}

.section-head-text h4 {
  margin: 0 0 2px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.section-head-text p {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.section-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.section-icon--blue {
  background: linear-gradient(135deg, #409eff, #096dd9);
}

.section-icon--green {
  background: linear-gradient(135deg, #67c23a, #389e0d);
}

.section-icon--orange {
  background: linear-gradient(135deg, #e6a23c, #d48806);
}

.section-icon--purple {
  background: linear-gradient(135deg, #722ed1, #531dab);
}

.section-body :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}
</style>
