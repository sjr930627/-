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

function levelLabel(level: keyof typeof workbenchReminderLevelMap) {
  return workbenchReminderLevelMap[level].label
}

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
      <div>
        <h3 class="card-title">待办事项</h3>
        <p class="card-sub">共 {{ todos.length }} 项</p>
      </div>
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
        <div class="todo-content">
          <div class="todo-title">{{ item.actionLabel }} · {{ item.groupTitle }}</div>
          <div class="todo-sub">{{ item.subtitle }}</div>
        </div>
        <div class="todo-tags">
          <span class="level-tag" :class="item.level">{{ levelLabel(item.level) }}</span>
          <span class="deadline-tag" :class="deadlineClass(item.level)">{{ item.deadlineLabel }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wb-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px 22px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.card-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: #94a3b8;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  cursor: pointer;
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
  cursor: pointer;
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

.todo-tags {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.level-tag,
.deadline-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.level-tag.urgent {
  background: #fef2f2;
  color: #dc2626;
}

.level-tag.important {
  background: #fff7ed;
  color: #ea580c;
}

.level-tag.normal {
  background: #f8fafc;
  color: #64748b;
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
