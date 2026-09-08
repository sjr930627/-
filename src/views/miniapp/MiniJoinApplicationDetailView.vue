<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { useAppStore } from '@/stores/app'
import { getWorkerJoinApplicationDisplay } from '@/services/miniJoin'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const detail = computed(() =>
  getWorkerJoinApplicationDisplay(
    store.workerJoinApplications,
    String(route.params.id || ''),
    store.departments,
    store.enterprises,
  ),
)

function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusHint(status?: string) {
  if (status === 'pending') return '企业正在审核，通过后将分配入驻部门与岗位。'
  if (status === 'approved') return '申请已通过，可在「当前组织」查看入驻结果。'
  if (status === 'rejected') return '申请未通过，可重新扫码其他部门二维码再次申请。'
  return ''
}
</script>

<template>
  <div class="detail-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/join-manage?tab=apps" />
      <div class="mini-nav-title">申请详情</div>
    </div>

    <div class="mini-page">
      <div v-if="!detail" class="mini-empty">
        申请不存在或已删除
        <button type="button" class="back-link" @click="router.replace('/miniapp/join-manage?tab=apps')">
          返回列表
        </button>
      </div>

      <template v-else>
        <div class="mini-card status-card">
          <div class="status-row">
            <strong>{{ detail.enterpriseName }}</strong>
            <span class="mini-tag" :class="detail.statusTag">{{ detail.statusLabel }}</span>
          </div>
          <p class="status-hint">{{ statusHint(detail.status) }}</p>
        </div>

        <div class="mini-card">
          <h3 class="section-title">申请信息</h3>
          <div class="row"><span>企业</span><span>{{ detail.enterpriseName }}</span></div>
          <div class="row"><span>部门</span><span>{{ detail.departmentName }}</span></div>
          <div class="row"><span>岗位</span><span>{{ detail.appliedPositionLabel }}</span></div>
          <div class="row"><span>来源</span><span>{{ detail.sourceLabel }}</span></div>
          <div class="row"><span>申请时间</span><span>{{ formatTime(detail.appliedAt) }}</span></div>
        </div>

        <div v-if="detail.status !== 'pending'" class="mini-card">
          <h3 class="section-title">审批结果</h3>
          <div class="row"><span>审批时间</span><span>{{ formatTime(detail.reviewedAt) }}</span></div>
          <div v-if="detail.status === 'approved'" class="row">
            <span>入驻部门</span>
            <span>{{ detail.assignedDepartmentName || detail.departmentName }}</span>
          </div>
          <div v-if="detail.status === 'approved'" class="row">
            <span>入驻岗位</span>
            <span>{{ detail.assignedPosition || detail.appliedPositionLabel }}</span>
          </div>
          <div v-if="detail.reviewNote" class="note">{{ detail.reviewNote }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100%;
  background: #f5f6f8;
}

.status-card .status-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.status-card strong {
  font-size: 16px;
  color: #111827;
  line-height: 1.4;
}

.status-hint {
  margin: 10px 0 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

.section-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
}

.row:last-child {
  border-bottom: none;
}

.row span:first-child {
  color: #94a3b8;
  flex-shrink: 0;
}

.row span:last-child {
  color: #1f2937;
  text-align: right;
  font-weight: 500;
}

.note {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 13px;
  line-height: 1.45;
}

.back-link {
  display: block;
  margin: 12px auto 0;
  border: none;
  background: none;
  color: var(--mini-primary, #4fd1c5);
  font-size: 14px;
  font-weight: 600;
}
</style>
