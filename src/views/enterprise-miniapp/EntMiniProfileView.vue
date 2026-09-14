<script setup lang="ts">
import EntMiniPageHeader from '@/components/enterprise-miniapp/EntMiniPageHeader.vue'
</script>

<template>
  <div class="page">
    <EntMiniPageHeader title="我的" />
    <div class="placeholder">
      <div class="icon">我</div>
      <h2>我的</h2>
      <p>功能开发中，敬请期待</p>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  background: #f5f7fb;
}

.placeholder {
  margin: 48px 24px;
  padding: 36px 20px;
  border-radius: 16px;
  background: #fff;
  text-align: center;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  border-radius: 16px;
  background: #e8f3ff;
  color: #228bff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

h2 {
  margin: 0 0 8px;
  font-size: 17px;
  color: #111827;
}

p {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}
</style>
