<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { workbenchReminderLevelMap } from '@/constants/workbenchReminder'
import type { WorkbenchFlatTodo } from '@/services/workbenchTodos'

const props = defineProps<{
  todos: WorkbenchFlatTodo[]
}>()

const router = useRouter()
const tab = ref<'all' | 'urgent' | 'today'>('all')
const checked = ref<Record<string, boolean>>({})

const filteredTodos = computed(() => {
  if (tab.value === 'urgent') return props.todos.filter((t) => t.level === 'urgent')
  if (tab.value === 'today') return props.todos.filter((t) => t.isToday)
  return props.todos
})

function deadlineClass(level: keyof typeof workbenchReminderLevelMap) {
  if (level === 'urgent') return 'deadline-urgent'
  if (level === 'important') return 'deadline-important'
  return 'deadline-normal'
}

function goTodo(path: string) {
  router.push(path)
}
</script>

<template>
  <section class="wb-card">
    <div class="card-head">
      <h3 class="card-title">待办事项</h3>
      <el-radio-group v-model="tab" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="urgent">紧急</el-radio-button>
        <el-radio-button value="today">今日</el-radio-button>
      </el-radio-group>
    </div>

    <el-empty v-if="!filteredTodos.length" description="暂无待办，一切顺利" :image-size="64" />

    <div v-else class="todo-list">
      <div
        v-for="item in filteredTodos"
        :key="item.id"
        class="todo-item"
        :class="{ done: checked[item.id] }"
        @click="goTodo(item.path)"
      >
        <el-checkbox v-model="checked[item.id]" @click.stop />
        <span class="deadline-tag" :class="deadlineClass(item.level)">{{ item.deadlineLabel }}</span>
        <div class="todo-content">
          <div class="todo-title">{{ item.actionLabel }} · {{ item.groupTitle }}</div>
          <div class="todo-sub">{{ item.subtitle }}</div>
        </div>
      </div>
    </div>
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

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  cursor: pointer;
  background: #fff;
}

.todo-item:hover {
  background: #f8fafc;
}

.todo-item.done {
  opacity: 0.55;
}

.todo-item.done .todo-title,
.todo-item.done .todo-sub {
  text-decoration: line-through;
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
  margin-top: 2px;
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
</style>
