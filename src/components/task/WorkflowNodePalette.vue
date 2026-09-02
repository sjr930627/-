<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WorkflowPaletteItem } from '@/constants/workflowPalette'
import {
  workflowPaletteCategoryMap,
  workflowPaletteItems,
  workflowPaletteVisibleCategories,
  isPaletteItemVisible,
} from '@/constants/workflowPalette'

const props = withDefaults(
  defineProps<{
    readonly?: boolean
  }>(),
  { readonly: false },
)

const emit = defineEmits<{
  dragStart: [item: WorkflowPaletteItem]
}>()

const collapsed = ref(false)

const keyword = ref('')

const categories = workflowPaletteVisibleCategories

const grouped = computed(() =>
  categories
    .map((category) => ({
      category,
      label: workflowPaletteCategoryMap[category],
      items: workflowPaletteItems.filter((item) => {
        if (!isPaletteItemVisible(item)) return false
        if (item.category !== category) return false
        const q = keyword.value.trim().toLowerCase()
        if (!q) return true
        return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
      }),
    }))
    .filter((g) => g.items.length),
)

function onDragStart(item: WorkflowPaletteItem, e: DragEvent) {
  if (props.readonly || item.disabled) {
    e.preventDefault()
    return
  }
  e.dataTransfer?.setData('application/workflow-palette', JSON.stringify({ key: item.key }))
  e.dataTransfer!.effectAllowed = 'copy'
  emit('dragStart', item)
}
</script>

<template>
  <aside class="node-palette" :class="{ collapsed, readonly }">
    <header class="palette-head">
      <span v-if="!collapsed" class="palette-title">📦 节点面板</span>
      <button
        type="button"
        class="palette-toggle"
        :title="collapsed ? '展开节点面板' : '收起节点面板'"
        @click="collapsed = !collapsed"
      >
        <span class="toggle-icon">{{ collapsed ? '›' : '‹' }}</span>
        <span v-if="collapsed" class="toggle-label">节点</span>
      </button>
    </header>
    <template v-if="!collapsed">
      <div class="palette-search">
        <input v-model="keyword" type="search" placeholder="🔍 搜索节点" />
      </div>
      <div class="palette-body">
        <p class="palette-tip">
          {{ readonly ? '流程已绑定任务，节点只读不可拖入' : '拖入的是节点类型，名称在画布上自定义' }}
        </p>
        <section v-for="group in grouped" :key="group.category" class="palette-group">
          <h4>{{ group.label }}</h4>
          <div
            v-for="item in group.items"
            :key="item.key"
            class="palette-item"
            :class="{ disabled: item.disabled || readonly }"
            :draggable="!item.disabled && !readonly"
            @dragstart="onDragStart(item, $event)"
          >
            <span class="item-icon">{{ item.icon }}</span>
            <div class="item-text">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-desc">{{ item.description }}</span>
            </div>
          </div>
        </section>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.node-palette {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
  background: #fafbfc;
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: width 0.2s ease;
}

.node-palette.collapsed {
  width: 44px;
}

.node-palette.readonly {
  opacity: 0.92;
}

.palette-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 12px 10px 8px;
  border-bottom: 1px solid #eef0f3;
  flex-shrink: 0;
}

.node-palette.collapsed .palette-head {
  flex-direction: column;
  padding: 10px 4px;
  gap: 8px;
}

.palette-title {
  font-size: 13px;
  font-weight: 700;
  color: #1f2937;
  min-width: 0;
}

.palette-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  color: #64748b;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.node-palette:not(.collapsed) .palette-toggle {
  width: 28px;
  height: 28px;
}

.node-palette.collapsed .palette-toggle {
  width: 36px;
  min-height: 72px;
  flex-direction: column;
  padding: 8px 4px;
}

.palette-toggle:hover {
  background: #f1f5f9;
  color: #334155;
  border-color: #cbd5e1;
}

.toggle-icon {
  font-size: 14px;
  line-height: 1;
  font-weight: 600;
}

.toggle-label {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  writing-mode: vertical-rl;
  letter-spacing: 2px;
}

.palette-search {
  padding: 8px 12px;
}

.palette-search input {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12px;
  background: #fff;
}

.palette-body {
  flex: 1;
  overflow: auto;
  padding: 4px 8px 12px;
}

.palette-tip {
  margin: 4px 6px 8px;
  font-size: 10px;
  color: #9ca3af;
  line-height: 1.4;
}

.palette-group h4 {
  margin: 10px 6px 6px;
  font-size: 11px;
  color: #9ca3af;
  font-weight: 600;
}

.palette-category-hint {
  margin: 0 6px 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f3f4f6;
  font-size: 10px;
  color: #6b7280;
  line-height: 1.45;
}

.palette-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: grab;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.palette-item:hover:not(.disabled) {
  background: #fff;
  border-color: #dbeafe;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.08);
}

.palette-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.palette-item:active:not(.disabled) {
  cursor: grabbing;
}

.item-icon {
  font-size: 16px;
  line-height: 1.2;
}

.item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.item-name {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.item-desc {
  font-size: 10px;
  color: #9ca3af;
}
</style>
