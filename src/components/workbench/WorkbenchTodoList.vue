<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { workbenchReminderLevelMap } from '@/constants/workbenchReminder'
import type { WorkbenchFlatTodo } from '@/services/workbenchTodos'

const props = defineProps<{
  todos: WorkbenchFlatTodo[]
}>()

const router = useRouter()
const PAGE_SIZE = 10
const tab = ref<'all' | 'urgent' | 'today'>('all')
const page = ref(1)

const filteredTodos = computed(() => {
  if (tab.value === 'urgent') return props.todos.filter((t) => t.level === 'urgent')
  if (tab.value === 'today') return props.todos.filter((t) => t.isToday)
  return props.todos
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredTodos.value.length / PAGE_SIZE)))

const pageItems = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredTodos.value.slice(start, start + PAGE_SIZE)
})

watch(tab, () => {
  page.value = 1
})

watch(
  () => filteredTodos.value.length,
  () => {
    if (page.value > totalPages.value) page.value = totalPages.value
  },
)

function deadlineClass(level: keyof typeof workbenchReminderLevelMap) {
  if (level === 'urgent') return 'deadline-urgent'
  if (level === 'important') return 'deadline-important'
  return 'deadline-normal'
}

function runAction(item: WorkbenchFlatTodo) {
  if (item.disabledReason || !item.path) {
    ElMessage.warning(item.disabledReason || '暂不可跳转')
    return
  }
  router.push(item.path)
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
        <h3 class="card-title">待办事项</h3>
        <p class="card-desc">当前需办理的事项，办结后自动消失</p>
      </div>
      <el-radio-group v-model="tab" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="urgent">紧急</el-radio-button>
        <el-radio-button value="today">今日</el-radio-button>
      </el-radio-group>
    </div>

    <el-empty v-if="!filteredTodos.length" description="暂无待办，一切顺利" :image-size="64" />

    <template v-else>
      <div class="todo-list">
        <div v-for="item in pageItems" :key="item.id" class="todo-item">
          <span class="deadline-tag" :class="deadlineClass(item.level)">{{ item.deadlineLabel }}</span>
          <div class="todo-content">
            <div class="todo-title">{{ item.title }}</div>
            <div class="todo-sub">{{ item.subtitle }}</div>
          </div>
          <el-button type="primary" link @click="runAction(item)">{{ item.actionLabel }}</el-button>
        </div>
      </div>

      <div v-if="filteredTodos.length > PAGE_SIZE" class="pager">
        <button type="button" class="pager-btn" :disabled="page <= 1" @click="prevPage">
          <el-icon><ArrowLeft /></el-icon>
          上一页
        </button>
        <span class="pager-info">第 {{ page }} / {{ totalPages }} 页 · 共 {{ filteredTodos.length }} 条</span>
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
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

.card-desc {
  margin: 6px 0 0 13px;
  font-size: 12px;
  color: #94a3b8;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  background: #fff;
}

.todo-item:hover {
  background: #f8fafc;
}

.todo-content {
  flex: 1;
  min-width: 0;
}

.todo-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.todo-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}

.deadline-tag {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.deadline-tag.deadline-urgent {
  background: #fef2f2;
  color: #dc2626;
}

.deadline-tag.deadline-important {
  background: #fff7ed;
  color: #ea580c;
}

.deadline-tag.deadline-normal {
  background: #f8fafc;
  color: #64748b;
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
</style>
