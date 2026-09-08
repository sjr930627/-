<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { FullScreen, OfficeBuilding } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { listWorkerCurrentOrgs, listWorkerJoinApplications } from '@/services/miniJoin'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employee, employeeId } = useMiniAppWorker()
const activeTab = ref<'orgs' | 'apps'>('orgs')

function syncTabFromRoute() {
  activeTab.value = route.query.tab === 'apps' ? 'apps' : 'orgs'
}

syncTabFromRoute()
watch(() => route.query.tab, syncTabFromRoute)

const currentOrgs = computed(() =>
  listWorkerCurrentOrgs(
    employee.value,
    store.workerJoinApplications,
    store.departments,
    store.enterprises,
    store.teams,
  ),
)

const applications = computed(() =>
  listWorkerJoinApplications(
    store.workerJoinApplications,
    employeeId.value,
    store.departments,
    store.enterprises,
  ),
)

function formatTime(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function setTab(tab: 'orgs' | 'apps') {
  activeTab.value = tab
  router.replace({ path: '/miniapp/join-manage', query: tab === 'apps' ? { tab: 'apps' } : {} })
}

async function openScanJoin() {
  try {
    const { value } = await ElMessageBox.prompt(
      '演示：粘贴部门入驻二维码内容（JOIN|企业ID|部门ID）',
      '扫码入驻',
      {
        confirmButtonText: '下一步',
        cancelButtonText: '取消',
        inputPlaceholder: 'JOIN|ent_xxx|dept_xxx',
        inputValue: 'JOIN|ent_stars_telecom|dept_prod_a',
      },
    )
    const payload = String(value || '').trim()
    if (!payload) {
      ElMessage.warning('请填写二维码内容')
      return
    }
    router.push({ path: '/miniapp/join-apply', query: { qr: payload } })
  } catch {
    /* cancel */
  }
}

function openDetail(id: string) {
  router.push(`/miniapp/join-applications/${id}`)
}
</script>

<template>
  <div class="join-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title join-nav-title">入驻管理</div>
      <button type="button" class="join-scan-btn" @click="openScanJoin">
        <el-icon :size="16"><FullScreen /></el-icon>
        扫码
      </button>
    </div>

    <div class="join-tabs">
      <button
        type="button"
        class="join-tab"
        :class="{ active: activeTab === 'orgs' }"
        @click="setTab('orgs')"
      >
        当前组织
        <span v-if="currentOrgs.length" class="join-tab-count">{{ currentOrgs.length }}</span>
      </button>
      <button
        type="button"
        class="join-tab"
        :class="{ active: activeTab === 'apps' }"
        @click="setTab('apps')"
      >
        入驻申请
        <span v-if="applications.length" class="join-tab-count">{{ applications.length }}</span>
      </button>
    </div>

    <div class="mini-page">
      <template v-if="activeTab === 'orgs'">
        <div v-for="org in currentOrgs" :key="org.key" class="mini-card org-card">
          <div class="org-head">
            <div class="org-icon">
              <el-icon :size="18"><OfficeBuilding /></el-icon>
            </div>
            <div class="org-head-main">
              <div class="org-name">{{ org.enterpriseName }}</div>
              <div class="org-path">{{ org.orgPath }}</div>
            </div>
            <span class="mini-tag" :class="org.primary ? 'green' : 'blue'">
              {{ org.primary ? '当前在岗' : '已入驻' }}
            </span>
          </div>
          <div class="org-rows">
            <div class="org-row">
              <span>岗位</span>
              <span>{{ org.position }}</span>
            </div>
            <div v-if="org.teamName" class="org-row">
              <span>班组</span>
              <span>{{ org.teamName }}</span>
            </div>
            <div v-if="org.hireDate" class="org-row">
              <span>入驻日期</span>
              <span>{{ org.hireDate }}</span>
            </div>
          </div>
        </div>
        <div v-if="currentOrgs.length === 0" class="mini-empty">暂未入驻任何组织</div>
      </template>

      <template v-else>
        <div
          v-for="app in applications"
          :key="app.id"
          class="mini-card app-card"
          @click="openDetail(app.id)"
        >
          <div class="app-head">
            <div class="app-title">{{ app.enterpriseName }}</div>
            <span class="mini-tag" :class="app.statusTag">{{ app.statusLabel }}</span>
          </div>
          <div class="app-dept">申请部门：{{ app.departmentName }}</div>
          <div class="app-dept">申请岗位：{{ app.appliedPositionLabel }}</div>
          <div v-if="app.status === 'approved' && app.assignedDepartmentName" class="app-dept">
            入驻部门：{{ app.assignedDepartmentName }}
            <template v-if="app.assignedPosition"> · {{ app.assignedPosition }}</template>
          </div>
          <div v-if="app.reviewNote" class="app-note">{{ app.reviewNote }}</div>
          <div class="app-foot">
            <span>
              申请时间 {{ formatTime(app.appliedAt) }}
              <template v-if="app.reviewedAt"> · 审批 {{ formatTime(app.reviewedAt) }}</template>
            </span>
            <button type="button" class="detail-link" @click.stop="openDetail(app.id)">
              查看详情
            </button>
          </div>
        </div>
        <div v-if="applications.length === 0" class="mini-empty">
          暂无入驻申请
          <button type="button" class="scan-empty-btn" @click="openScanJoin">扫码申请入驻</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.join-page {
  min-height: 100%;
  background: #f5f6f8;
}

.join-nav-title {
  margin-right: 0;
}

.join-scan-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: var(--mini-primary, #4fd1c5);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0 2px;
}

.join-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 12px 0;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.join-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
}

.join-tab.active {
  color: var(--app-primary, #4fd1c5);
  border-bottom-color: var(--app-primary, #4fd1c5);
  font-weight: 600;
}

.join-tab-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--app-primary-light, #e6fffa);
  color: var(--app-primary, #4fd1c5);
  font-size: 11px;
  line-height: 18px;
}

.org-head,
.app-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.org-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #e6fffa;
  color: #14b8a6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.org-head-main {
  flex: 1;
  min-width: 0;
}

.org-name,
.app-title {
  font-size: 15px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.35;
}

.org-path,
.app-dept {
  margin-top: 4px;
  font-size: 12px;
  color: #666;
  line-height: 1.45;
}

.org-rows {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #f3f4f6;
}

.org-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
  font-size: 13px;
}

.org-row span:first-child {
  color: #999;
  flex-shrink: 0;
}

.org-row span:last-child {
  color: #333;
  text-align: right;
}

.app-card {
  cursor: pointer;
}

.app-title {
  flex: 1;
  min-width: 0;
}

.app-note {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 12px;
  line-height: 1.45;
}

.app-foot {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: #bbb;
}

.detail-link {
  border: none;
  background: none;
  color: var(--mini-primary, #4fd1c5);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.scan-empty-btn {
  display: block;
  margin: 14px auto 0;
  border: none;
  background: var(--mini-primary, #4fd1c5);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 18px;
  border-radius: 10px;
  cursor: pointer;
}
</style>
