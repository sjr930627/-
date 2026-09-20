<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import {
  normalizeWorkbenchMessageCategory,
  workbenchMessageCategories,
  workbenchMessageCategoryMap,
  type WorkbenchMessageCategory,
} from '@/constants/workbenchMessage'
import type { Notification } from '@/types'

const props = defineProps<{
  messages: Notification[]
}>()

const store = useAppStore()

const PAGE_SIZE = 10
const categoryFilter = ref<'all' | WorkbenchMessageCategory>('all')
const readFilter = ref<'all' | 'unread' | 'read'>('all')
const page = ref(1)

const detailVisible = ref(false)
const current = ref<Notification | null>(null)

function resolveCategory(m: Notification): WorkbenchMessageCategory | undefined {
  return normalizeWorkbenchMessageCategory(m.category)
}

const filtered = computed(() =>
  props.messages.filter((m) => {
    const cat = resolveCategory(m)
    if (!cat) return false
    if (categoryFilter.value !== 'all' && cat !== categoryFilter.value) return false
    if (readFilter.value === 'unread' && m.read) return false
    if (readFilter.value === 'read' && !m.read) return false
    return true
  }),
)

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))

const pageItems = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})

const unreadCount = computed(() =>
  props.messages.filter((m) => !m.read && resolveCategory(m)).length,
)

watch([categoryFilter, readFilter], () => {
  page.value = 1
})

watch(
  () => filtered.value.length,
  () => {
    if (page.value > totalPages.value) page.value = totalPages.value
  },
)

function categoryLabel(m: Notification) {
  const cat = resolveCategory(m)
  if (cat) return workbenchMessageCategoryMap[cat].label
  return '其他'
}

function openDetail(m: Notification) {
  current.value = m
  detailVisible.value = true
}

function confirmRead() {
  if (current.value && !current.value.read) {
    store.markNotificationRead(current.value.id)
  }
  detailVisible.value = false
  current.value = null
}

function cancelDetail() {
  detailVisible.value = false
  current.value = null
}

function formatTime(iso: string) {
  return iso.slice(0, 16).replace('T', ' ')
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
      <div>
        <h3 class="card-title">消息提醒</h3>
        <p class="card-desc">
          按分类查看 · 未读 {{ unreadCount }} 条
        </p>
      </div>
      <el-radio-group v-model="readFilter" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="unread">未读</el-radio-button>
        <el-radio-button value="read">已读</el-radio-button>
      </el-radio-group>
    </div>

    <div class="category-bar">
      <button
        type="button"
        class="cat-pill"
        :class="{ active: categoryFilter === 'all' }"
        @click="categoryFilter = 'all'"
      >
        全部
      </button>
      <button
        v-for="key in workbenchMessageCategories"
        :key="key"
        type="button"
        class="cat-pill"
        :class="{ active: categoryFilter === key }"
        @click="categoryFilter = key"
      >
        {{ workbenchMessageCategoryMap[key].label }}
      </button>
    </div>

    <el-empty v-if="!filtered.length" description="暂无消息" :image-size="64" />

    <template v-else>
      <div class="msg-list">
        <button
          v-for="item in pageItems"
          :key="item.id"
          type="button"
          class="msg-item"
          :class="{ unread: !item.read }"
          @click="openDetail(item)"
        >
          <span v-if="!item.read" class="dot" />
          <div class="msg-body">
            <div class="msg-top">
              <span class="msg-cat">{{ categoryLabel(item) }}</span>
              <span class="msg-time">{{ formatTime(item.createdAt) }}</span>
            </div>
            <div class="msg-title">{{ item.title }}</div>
            <div class="msg-preview">{{ item.content }}</div>
          </div>
        </button>
      </div>

      <div v-if="filtered.length > PAGE_SIZE" class="pager">
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

  <el-dialog
    v-model="detailVisible"
    :title="current?.title || '消息详情'"
    width="520px"
    destroy-on-close
    @close="cancelDetail"
  >
    <div v-if="current" class="detail">
      <div class="detail-meta">
        <el-tag size="small">{{ categoryLabel(current) }}</el-tag>
        <span class="detail-time">{{ formatTime(current.createdAt) }}</span>
        <el-tag size="small" :type="current.read ? 'info' : 'warning'">
          {{ current.read ? '已读' : '未读' }}
        </el-tag>
      </div>
      <p class="detail-content">{{ current.content }}</p>
    </div>
    <template #footer>
      <el-button @click="cancelDetail">取消</el-button>
      <el-button type="primary" @click="confirmRead">确认已读</el-button>
    </template>
  </el-dialog>
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  padding-left: 10px;
  border-left: 3px solid #7c3aed;
  line-height: 1.2;
}

.card-desc {
  margin: 6px 0 0 13px;
  font-size: 12px;
  color: #94a3b8;
}

.category-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.cat-pill {
  border: none;
  border-radius: 999px;
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  color: #475569;
  background: #f1f5f9;
  transition: background 0.15s ease, color 0.15s ease;
}

.cat-pill:hover:not(.active) {
  background: #e2e8f0;
  color: #334155;
}

.cat-pill.active {
  color: #fff;
  background: #14b8a6;
}

.msg-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.msg-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;
  text-align: left;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fff;
  cursor: pointer;
}

.msg-item:hover {
  background: #f8fafc;
}

.msg-item.unread {
  border-color: #e9d5ff;
  background: #faf5ff;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7c3aed;
  margin-top: 6px;
  flex-shrink: 0;
}

.msg-body {
  flex: 1;
  min-width: 0;
}

.msg-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.msg-cat {
  font-size: 11px;
  font-weight: 600;
  color: #7c3aed;
}

.msg-time {
  font-size: 11px;
  color: #94a3b8;
  flex-shrink: 0;
}

.msg-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.msg-preview {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
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

.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-time {
  font-size: 12px;
  color: #94a3b8;
}

.detail-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #334155;
  white-space: pre-wrap;
}
</style>
