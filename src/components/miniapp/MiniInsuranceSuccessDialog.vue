<script setup lang="ts">
export interface InsuranceSuccessInfo {
  productName: string
  workDate: string
  shiftLabel: string
  location: string
  premium: number
  policyNo: string
}

defineProps<{
  visible: boolean
  info: InsuranceSuccessInfo | null
}>()

const emit = defineEmits<{
  close: []
  detail: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && info" class="ins-overlay" @click.self="emit('close')">
      <div class="ins-dialog">
        <div class="ins-icon-wrap">
          <div class="ins-icon">✓</div>
        </div>
        <div class="ins-title">保险申报成功</div>
        <div class="ins-subtitle">今日打卡已完成，工伤保险已自动申报</div>

        <div class="ins-rows">
          <div class="ins-row">
            <span class="ins-row-icon green">🛡</span>
            <span class="ins-row-label">保险类型</span>
            <span class="ins-row-value">{{ info.productName }}</span>
          </div>
          <div class="ins-row">
            <span class="ins-row-icon blue">📅</span>
            <span class="ins-row-label">申报日期</span>
            <span class="ins-row-value">{{ info.workDate }}</span>
          </div>
          <div class="ins-row">
            <span class="ins-row-icon orange">🕐</span>
            <span class="ins-row-label">班次时段</span>
            <span class="ins-row-value">{{ info.shiftLabel }}</span>
          </div>
          <div class="ins-row">
            <span class="ins-row-icon red">📍</span>
            <span class="ins-row-label">工作地点</span>
            <span class="ins-row-value">{{ info.location }}</span>
          </div>
        </div>

        <div class="ins-premium">
          <span class="ins-premium-left">💴 今日保费</span>
          <span class="ins-premium-value">¥ {{ info.premium.toFixed(2) }}/天</span>
        </div>

        <div class="ins-tip">
          <span class="ins-tip-icon">ⓘ</span>
          <span>保险自打卡成功时生效，保障至当日班次结束。如有疑问请联系人事部门。</span>
        </div>

        <div class="ins-actions">
          <button type="button" class="ins-btn-outline" @click="emit('detail')">查看详情</button>
          <button type="button" class="ins-btn-primary" @click="emit('close')">我知道了</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ins-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.ins-dialog {
  width: 100%;
  max-width: 340px;
  background: #fff;
  border-radius: 16px;
  padding: 24px 20px 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.ins-icon-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.ins-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e60012, #ff4d4f);
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(230, 0, 18, 0.35);
}

.ins-title {
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 6px;
}

.ins-subtitle {
  text-align: center;
  font-size: 12px;
  color: #999;
  line-height: 1.5;
  margin-bottom: 16px;
  padding: 0 8px;
}

.ins-rows {
  border-top: 1px dashed #ffd6d6;
  border-bottom: 1px dashed #ffd6d6;
  padding: 4px 0;
  margin-bottom: 12px;
}

.ins-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px dashed #fff0f0;
  font-size: 13px;
}

.ins-row:last-child {
  border-bottom: none;
}

.ins-row-icon {
  width: 22px;
  text-align: center;
  flex-shrink: 0;
  font-size: 14px;
}

.ins-row-label {
  color: #666;
  flex: 1;
}

.ins-row-value {
  color: #333;
  font-weight: 500;
  text-align: right;
  max-width: 55%;
  word-break: break-all;
}

.ins-premium {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff5f5;
  border-radius: 999px;
  padding: 10px 16px;
  margin-bottom: 12px;
}

.ins-premium-left {
  font-size: 13px;
  color: #666;
}

.ins-premium-value {
  font-size: 16px;
  font-weight: 700;
  color: #e60012;
}

.ins-tip {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: #999;
  line-height: 1.5;
  margin-bottom: 16px;
}

.ins-tip-icon {
  color: #e60012;
  flex-shrink: 0;
  font-weight: 700;
}

.ins-actions {
  display: flex;
  gap: 10px;
}

.ins-btn-outline,
.ins-btn-primary {
  flex: 1;
  padding: 11px 12px;
  border-radius: 22px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.ins-btn-outline {
  border: 1px solid #ddd;
  background: #fff;
  color: #333;
}

.ins-btn-primary {
  border: none;
  background: var(--mini-primary, #4FD1C5);
  color: #fff;
}
</style>
