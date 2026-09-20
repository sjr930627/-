<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type {
  RecruitmentReminderCategory,
  RecruitmentReminderItem,
} from '@/services/workbenchDashboard'

const props = defineProps<{
  reminders?: RecruitmentReminderItem[]
}>()

const router = useRouter()
const PAGE_SIZE = 10

const categoryTab = ref<'all' | RecruitmentReminderCategory>('all')
const page = ref(1)

const list = computed(() => props.reminders ?? [])

const counts = computed(() => {
  const all = list.value.length
  const urgent = list.value.filter((i) => i.category === 'urgent').length
  const remind = list.value.filter((i) => i.category === 'remind').length
  const watch = list.value.filter((i) => i.category === 'watch').length
  return { all, urgent, remind, watch }
})

const filtered = computed(() => {
  if (categoryTab.value === 'all') return list.value
  return list.value.filter((i) => i.category === categoryTab.value)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))

const pageItems = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})

watch(categoryTab, () => {
  page.value = 1
})

watch(
  () => filtered.value.length,
  () => {
    if (page.value > totalPages.value) page.value = totalPages.value
  },
)

function goItem(item: RecruitmentReminderItem) {
  if (!item.path || item.path.includes('/recruitment/')) {
    ElMessage.warning('招聘模块暂未开放')
    return
  }
  router.push(item.path)
}

function goAll() {
  ElMessage.warning('招聘模块暂未开放')
}

function prevPage() {
  if (page.value > 1) page.value -= 1
}

function nextPage() {
  if (page.value < totalPages.value) page.value += 1
}
</script>

<template>
  <section class="wb-card">
    <div class="card-head">
      <h3 class="card-title">招聘进度提醒</h3>
      <div class="head-right">
        <div class="cat-tabs">
          <button
            type="button"
            class="cat-tab"
            :class="{ active: categoryTab === 'all' }"
            @click="categoryTab = 'all'"
          >
            全部 {{ counts.all }}
          </button>
          <button
            type="button"
            class="cat-tab"
            :class="{ active: categoryTab === 'urgent' }"
            @click="categoryTab = 'urgent'"
          >
            紧急 {{ counts.urgent }}
          </button>
          <button
            type="button"
            class="cat-tab"
            :class="{ active: categoryTab === 'remind' }"
            @click="categoryTab = 'remind'"
          >
            提醒 {{ counts.remind }}
          </button>
          <button
            type="button"
            class="cat-tab"
            :class="{ active: categoryTab === 'watch' }"
            @click="categoryTab = 'watch'"
          >
            关注 {{ counts.watch }}
          </button>
        </div>
        <button type="button" class="view-all" @click="goAll">
          查看全部
          <el-icon><ArrowRight /></el-icon>
        </button>
      </div>
    </div>

    <el-empty v-if="!filtered.length" description="暂无招聘进度提醒" :image-size="64" />

    <template v-else>
      <div class="reminder-grid">
        <button
          v-for="item in pageItems"
          :key="item.id"
          type="button"
          class="reminder-item"
          @click="goItem(item)"
        >
          <span class="status-tag" :class="`tone-${item.tagTone}`">{{ item.tag }}</span>
          <div class="reminder-body">
            <div class="reminder-main">
              <span class="candidate">{{ item.title }}</span>
              <span class="alert" :class="item.alertTone === 'danger' ? 'alert-danger' : 'alert-info'">
                {{ item.alert }}
              </span>
            </div>
            <div class="reminder-detail">{{ item.detail }}</div>
          </div>
          <el-icon class="reminder-arrow"><ArrowRight /></el-icon>
        </button>
      </div>

      <div class="pager">
        <button type="button" class="pager-btn" :disabled="page <= 1" @click="prevPage">
          <el-icon><ArrowLeft /></el-icon>
          上一页
        </button>
        <span class="pager-info">第 {{ page }} / {{ totalPages }} 页 · 共 {{ filtered.length }} 条</span>
        <button
          type="button"
          class="pager-btn"
          :disabled="page >= totalPages"
          @click="nextPage"
        >
          下一页
          <el-icon><ArrowRight /></el-icon>
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.wb-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px rgba(15, 23, 42, 0.04);
  border: 1px solid #eef2f7;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  padding-left: 10px;
  border-left: 3px solid #2563eb;
  line-height: 1.2;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.cat-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cat-tab {
  border: none;
  background: transparent;
  padding: 6px 10px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  line-height: 1.2;
}

.cat-tab.active {
  color: #2563eb;
  font-weight: 600;
  border-bottom-color: #2563eb;
}

.view-all {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
}

.view-all:hover {
  color: #64748b;
}

.reminder-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.reminder-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.reminder-item:hover {
  background: #eff6ff;
  border-color: #dbeafe;
}

.status-tag {
  flex-shrink: 0;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid currentColor;
  background: #fff;
  white-space: nowrap;
}

.tone-green {
  color: #16a34a;
}

.tone-blue {
  color: #2563eb;
}

.tone-orange {
  color: #ea580c;
}

.tone-purple {
  color: #7c3aed;
}

.tone-teal {
  color: #0d9488;
}

.tone-gray {
  color: #64748b;
}

.reminder-body {
  flex: 1;
  min-width: 0;
}

.reminder-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.candidate {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  flex-shrink: 0;
}

.alert {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-info {
  color: #2563eb;
}

.alert-danger {
  color: #dc2626;
}

.reminder-detail {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reminder-arrow {
  color: #cbd5e1;
  flex-shrink: 0;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 4px;
}

.pager-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #475569;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}

.pager-btn:disabled {
  color: #cbd5e1;
  border-color: #f1f5f9;
  cursor: not-allowed;
}

.pager-btn:not(:disabled):hover {
  border-color: #cbd5e1;
  color: #0f172a;
}

.pager-info {
  font-size: 13px;
  color: #64748b;
}

@media (max-width: 900px) {
  .reminder-grid {
    grid-template-columns: 1fr;
  }
}
</style>
