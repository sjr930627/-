<script setup lang="ts">
import { useRouter } from 'vue-router'
import { workbenchReminderLevelMap } from '@/constants/workbenchReminder'
import type { WorkbenchTodoGroup } from '@/services/workbenchTodos'

defineProps<{
  groups: WorkbenchTodoGroup[]
  total: number
}>()

const router = useRouter()

function levelMeta(level: keyof typeof workbenchReminderLevelMap) {
  return workbenchReminderLevelMap[level]
}
</script>

<template>
  <div class="workbench-todo-panel">
    <div class="panel-head">
      <span class="panel-icon">📋</span>
      <h3 class="panel-title">今日待办</h3>
      <span v-if="total" class="panel-count">（{{ total }}项）</span>
    </div>

    <el-empty v-if="!groups.length" description="暂无待办，一切顺利" :image-size="72" />

    <div v-else class="todo-groups">
      <section v-for="group in groups" :key="group.id" class="todo-group">
        <div class="group-head" :style="{ borderColor: levelMeta(group.level).border }">
          <span class="group-level">
            {{ levelMeta(group.level).emoji }}
            {{ levelMeta(group.level).label }}-{{ group.title }}
          </span>
        </div>

        <div class="todo-list">
          <div
            v-for="item in group.items"
            :key="item.id"
            class="todo-row"
            :class="item.level"
          >
            <span class="todo-icon">{{ item.icon }}</span>
            <div class="todo-main">
              <span class="todo-title">{{ item.title }}</span>
              <span class="todo-sep">｜</span>
              <span class="todo-detail">{{ item.detail }}</span>
            </div>
            <el-button
              link
              type="primary"
              class="todo-action"
              @click="router.push(item.path)"
            >
              {{ item.actionLabel }}
            </el-button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.workbench-todo-panel {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 18px 20px;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.panel-icon {
  font-size: 18px;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.panel-count {
  font-size: 14px;
  color: #909399;
}

.todo-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-head {
  padding: 8px 12px;
  border-left: 4px solid;
  background: #fafafa;
  border-radius: 4px;
  margin-bottom: 8px;
}

.group-level {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.todo-list {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.todo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}

.todo-row:last-child {
  border-bottom: none;
}

.todo-row.urgent {
  background: #fffafa;
}

.todo-row.important {
  background: #fffcf6;
}

.todo-row.normal {
  background: #fafcff;
}

.todo-icon {
  flex-shrink: 0;
  font-size: 15px;
}

.todo-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  color: #606266;
}

.todo-title {
  font-weight: 600;
  color: #303133;
}

.todo-sep {
  color: #dcdfe6;
}

.todo-detail {
  color: #606266;
}

.todo-action {
  flex-shrink: 0;
  font-weight: 600;
}
</style>
