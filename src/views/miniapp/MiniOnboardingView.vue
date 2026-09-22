<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
</script>

<template>
  <div class="onboarding-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title">完善档案</div>
    </div>

    <div class="dev-placeholder">
      <div class="dev-placeholder-icon">实</div>
      <h3>实名认证</h3>
      <p>功能开发中，敬请期待</p>
    </div>
  </div>
</template>

<style scoped>
.onboarding-page {
  min-height: 100%;
  background: #f5f6f8;
}

.dev-placeholder {
  margin-top: 80px;
  text-align: center;
  color: #999;
}

.dev-placeholder-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  border-radius: 16px;
  background: #e6fffa;
  color: var(--mini-primary, #4fd1c5);
  font-size: 22px;
  font-weight: 700;
  line-height: 56px;
}

.dev-placeholder h3 {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.dev-placeholder p {
  margin: 0;
  font-size: 13px;
}
</style>
