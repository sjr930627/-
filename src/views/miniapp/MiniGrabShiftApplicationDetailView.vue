<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { buildGrabShiftApplicationDisplay, grabStatusTagClass } from '@/services/miniApplication'
import { getGrabShiftPostExtra } from '@/mock/miniappDetailSeed'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()

const app = computed(() =>
  store.grabShiftApplications.find(
    (a) => a.id === route.params.id && a.employeeId === employeeId.value,
  ),
)

const slot = computed(() =>
  app.value ? store.grabShiftSlots.find((s) => s.id === app.value!.slotId) : undefined,
)

const display = computed(() =>
  app.value ? buildGrabShiftApplicationDisplay(app.value, slot.value) : null,
)

const post = computed(() =>
  slot.value ? getGrabShiftPostExtra(slot.value.teamId, slot.value.teamName) : null,
)

const showPunchAction = computed(
  () => display.value?.phase === 'approved_upcoming' || display.value?.phase === 'approved_today',
)

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN')
}

function goPunch() {
  router.push('/miniapp/punch')
}
</script>

<template>
  <div class="detail-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/applications" />
      <div class="mini-nav-title">抢班报名详情</div>
    </div>

    <div v-if="display && slot" class="mini-page">
      <div class="mini-card">
        <div class="head-row">
          <h1 class="job-name">{{ post?.title ?? display.postTitle }}</h1>
          <span class="mini-tag" :class="grabStatusTagClass(display.phase, display.status)">
            {{ display.statusLabel }}
          </span>
        </div>
        <div class="meta-line">{{ post?.storeName ?? display.postTitle }}</div>
        <div class="shift-time">{{ display.date }} {{ display.timeRange }}</div>
        <div class="shift-pay">{{ display.payLabel }}</div>
      </div>

      <div class="mini-card status-card" :class="display.phase">
        <div class="mini-card-title">当前状态</div>
        <p class="status-text">{{ display.detailHint }}</p>

        <div v-if="display.status === 'pending'" class="info-box">
          <div>⏳ 管理员正在审核您的抢班报名</div>
          <div>通过后自动写入排班表，白名单人员免审即时通过</div>
        </div>

        <div v-else-if="display.status === 'rejected'" class="info-box warn">
          驳回原因：{{ display.reviewNote ?? '不符合班次要求' }}
        </div>

        <div v-else-if="showPunchAction" class="info-box punch">
          <div class="punch-title">📍 即将打卡上班</div>
          <div>请于 {{ display.timeRange.split('-')[0] }} 前到达 {{ post?.storeName ?? '工作站点' }}</div>
          <button type="button" class="mini-btn-primary punch-btn" @click="goPunch">去打卡</button>
        </div>

        <div v-else-if="display.phase === 'approved_done'" class="info-box">
          该班次已结束，可在收入中心查看结算记录。
        </div>
      </div>

      <div class="mini-card">
        <div class="mini-card-title">班次信息</div>
        <div class="info-row"><span>班次类型</span><span>{{ display.title }}</span></div>
        <div class="info-row"><span>薪酬方式</span><span class="money-text">{{ display.payLabel }}</span></div>
        <div class="info-row"><span>工作时长</span><span>{{ display.durationHours }} 小时</span></div>
        <div class="info-row"><span>工作日期</span><span>{{ display.date }}</span></div>
        <div class="info-row"><span>工作时段</span><span>{{ display.timeRange }}</span></div>
        <div class="info-row"><span>所属班组</span><span>{{ display.postTitle }}</span></div>
      </div>

      <div class="mini-card">
        <div class="mini-card-title">报名记录</div>
        <div class="info-row"><span>报名时间</span><span>{{ formatTime(display.createdAt) }}</span></div>
        <div v-if="display.reviewedAt" class="info-row">
          <span>审核时间</span><span>{{ formatTime(display.reviewedAt) }}</span>
        </div>
        <div v-if="app?.message" class="info-row"><span>报名说明</span><span>{{ app.message }}</span></div>
      </div>
    </div>

    <div v-else class="mini-empty">记录不存在</div>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100%;
  background: #f5f6f8;
}

.head-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.job-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

.meta-line {
  margin-top: 6px;
  font-size: 13px;
  color: #999;
}

.shift-time {
  margin-top: 10px;
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.shift-pay {
  margin-top: 6px;
  font-size: 16px;
  font-weight: 700;
  color: #ef4444;
}

.money-text {
  color: #ef4444;
  font-weight: 600;
}

.status-text {
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.info-box {
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
  background: #fafafa;
  font-size: 13px;
  color: #666;
  line-height: 1.6;
}

.info-box.warn {
  background: #fff1f0;
  color: #cf1322;
}

.info-box.punch {
  background: var(--app-primary-light);
  color: #333;
}

.punch-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--app-primary);
  margin-bottom: 6px;
}

.punch-btn {
  margin-top: 12px;
  border-radius: 20px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid #f5f5f5;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row span:first-child {
  color: #999;
  flex-shrink: 0;
}

.info-row span:last-child {
  color: #333;
  text-align: right;
}
</style>
