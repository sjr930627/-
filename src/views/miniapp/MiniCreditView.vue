<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { workerLevelColors } from '@/constants/miniapp'

const router = useRouter()
const { profileExt } = useMiniAppWorker()

const levelRules = [
  { level: '铜牌灵工', range: '0-40分', benefits: '基础任务大厅访问' },
  { level: '银牌灵工', range: '41-70分', benefits: '优先抢班、培训加速' },
  { level: '金牌灵工', range: '71-90分', benefits: '高价值任务优先、专属客服' },
  { level: '钻石灵工', range: '91-100分', benefits: '企业直派任务、最高结算系数' },
]

const creditTips = [
  '按时完成排班出勤 +2分/次',
  '任务验收通过 +3分/次',
  '培训考核通过 +5分/次',
  '迟到/缺勤 -5分/次',
  '任务被驳回 -3分/次',
]
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <button class="mini-nav-back" @click="router.back()">← 返回</button>
      <div class="mini-nav-title">等级与信用</div>
    </div>
    <div class="mini-page">
      <div class="mini-card" style="text-align: center; padding: 24px">
        <div
          style="font-size: 32px; font-weight: 800"
          :style="{ color: workerLevelColors[profileExt?.level ?? ''] ?? '#e60012' }"
        >
          {{ profileExt?.level ?? '银牌灵工' }}
        </div>
        <div style="font-size: 14px; color: #999; margin-top: 8px">能力等级分 {{ profileExt?.levelScore ?? 0 }} / 100</div>
        <div style="height: 8px; background: #f0f0f0; border-radius: 4px; margin: 16px 0 8px; overflow: hidden">
          <div
            :style="{ width: `${profileExt?.levelScore ?? 0}%`, height: '100%', background: '#e60012', borderRadius: '4px' }"
          />
        </div>
      </div>

      <div class="mini-card" style="text-align: center">
        <div style="font-size: 48px; font-weight: 800; color: #52c41a">{{ profileExt?.creditScore ?? 0 }}</div>
        <div style="font-size: 14px; color: #999">信用分 · {{ profileExt?.creditLevel ?? '良好' }}</div>
        <p style="font-size: 12px; color: #999; margin-top: 12px">
          信用分反映您的履约可靠性，影响抢班优先权和任务派发。
        </p>
      </div>

      <div class="mini-card">
        <div class="mini-card-title">等级说明</div>
        <div v-for="rule in levelRules" :key="rule.level" style="padding: 8px 0; border-bottom: 1px solid #f5f5f5">
          <div style="font-size: 14px; font-weight: 500">{{ rule.level }}（{{ rule.range }}）</div>
          <div style="font-size: 12px; color: #999">{{ rule.benefits }}</div>
        </div>
      </div>

      <div class="mini-card">
        <div class="mini-card-title">信用分规则</div>
        <div v-for="(tip, i) in creditTips" :key="i" style="font-size: 13px; color: #666; padding: 4px 0">
          · {{ tip }}
        </div>
      </div>
    </div>
  </div>
</template>
