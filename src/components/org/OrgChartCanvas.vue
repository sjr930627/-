<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DepartmentTreeNode } from '@/types'

export interface OrgChartNode extends DepartmentTreeNode {
  headcount?: number
}

const props = withDefaults(
  defineProps<{
    tree: OrgChartNode[]
    selectedId?: string
    lockedIds?: string[]
  }>(),
  {
    selectedId: '',
    lockedIds: () => [],
  },
)

const emit = defineEmits<{
  select: [id: string]
  addChild: [parentId: string | null]
  reorder: [draggedId: string, targetParentId: string | null, targetIndex: number]
}>()

const collapsedIds = ref<Set<string>>(new Set())
const accentPalette = ['#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#3b82f6']

function accentFor(node: OrgChartNode, siblingIndex: number) {
  if (node.orgType === 'enterprise' || !node.parentId) return '#3b82f6'
  return accentPalette[siblingIndex % accentPalette.length]
}

function isLocked(id: string) {
  return props.lockedIds.includes(id)
}

function canAddChild(node: OrgChartNode) {
  return !isLocked(node.id) && node.nodeType !== 'leaf'
}

function isCollapsed(id: string) {
  return collapsedIds.value.has(id)
}

function toggleCollapse(id: string) {
  const next = new Set(collapsedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsedIds.value = next
}

const dragState = ref<{ id: string; parentId: string | null } | null>(null)

function onDragStart(node: OrgChartNode, e: DragEvent) {
  if (isLocked(node.id)) {
    e.preventDefault()
    return
  }
  dragState.value = { id: node.id, parentId: node.parentId }
  e.dataTransfer?.setData('text/plain', node.id)
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDropOnParent(parentId: string | null, index: number, e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  const draggedId = e.dataTransfer?.getData('text/plain') || dragState.value?.id
  if (!draggedId || isLocked(draggedId)) return
  if (draggedId === parentId) return
  emit('reorder', draggedId, parentId, index)
  dragState.value = null
}

const hasNodes = computed(() => props.tree.length > 0)

watch(
  () => props.tree,
  () => {
    const ids = new Set<string>()
    const walk = (nodes: OrgChartNode[]) => {
      nodes.forEach((n) => {
        ids.add(n.id)
        walk(n.children as OrgChartNode[])
      })
    }
    walk(props.tree)
    collapsedIds.value = new Set([...collapsedIds.value].filter((id) => ids.has(id)))
  },
  { deep: true },
)
</script>

<template>
  <div class="org-canvas" @dragover="onDragOver">
    <el-empty v-if="!hasNodes" description="暂无组织节点" :image-size="72" />
    <div v-else class="org-canvas-scroll">
      <div class="org-flow">
        <div
          v-for="(root, rootIdx) in tree"
          :key="root.id"
          class="org-col"
          @drop="onDropOnParent(null, rootIdx, $event)"
        >
          <div
            class="org-card is-root"
            :class="{ 'is-selected': selectedId === root.id, 'is-locked': isLocked(root.id) }"
            draggable="true"
            @click="emit('select', root.id)"
            @dragstart="onDragStart(root, $event)"
          >
            <span class="drag-dots" aria-hidden="true" />
            <span class="org-card-name">{{ root.name }}</span>
            <span v-if="root.headcount != null" class="org-card-count">{{ root.headcount }}人</span>
            <button
              v-if="root.children?.length"
              type="button"
              class="icon-btn"
              :title="isCollapsed(root.id) ? '展开' : '收起'"
              @click.stop="toggleCollapse(root.id)"
            >
              {{ isCollapsed(root.id) ? '▸' : '▾' }}
            </button>
            <button
              v-if="canAddChild(root)"
              type="button"
              class="icon-btn add"
              title="添加子组织"
              @click.stop="emit('addChild', root.id)"
            >
              +
            </button>
          </div>

          <template v-if="root.children?.length && !isCollapsed(root.id)">
            <div class="org-connector" />
            <div class="org-children">
              <div
                v-for="(child, childIdx) in root.children as OrgChartNode[]"
                :key="child.id"
                class="org-branch"
                @drop="onDropOnParent(root.id, childIdx, $event)"
              >
                <div
                  class="org-card"
                  :class="{
                    'is-selected': selectedId === child.id,
                    'is-locked': isLocked(child.id),
                  }"
                  :style="{ '--accent': accentFor(child, childIdx) }"
                  draggable="true"
                  @click="emit('select', child.id)"
                  @dragstart="onDragStart(child, $event)"
                >
                  <span class="drag-dots" aria-hidden="true" />
                  <span class="accent-bar" />
                  <span class="org-card-name">{{ child.name }}</span>
                  <span v-if="child.headcount != null" class="org-card-count">{{ child.headcount }}人</span>
                  <button
                    v-if="child.children?.length"
                    type="button"
                    class="icon-btn"
                    @click.stop="toggleCollapse(child.id)"
                  >
                    {{ isCollapsed(child.id) ? '▸' : '▾' }}
                  </button>
                  <button
                    v-if="canAddChild(child)"
                    type="button"
                    class="icon-btn add"
                    @click.stop="emit('addChild', child.id)"
                  >
                    +
                  </button>
                </div>

                <template v-if="child.children?.length && !isCollapsed(child.id)">
                  <div class="org-connector" />
                  <div class="org-children">
                    <div
                      v-for="(g, gIdx) in child.children as OrgChartNode[]"
                      :key="g.id"
                      class="org-branch"
                      @drop="onDropOnParent(child.id, gIdx, $event)"
                    >
                      <div
                        class="org-card"
                        :class="{
                          'is-selected': selectedId === g.id,
                          'is-locked': isLocked(g.id),
                        }"
                        :style="{ '--accent': accentFor(g, gIdx) }"
                        draggable="true"
                        @click="emit('select', g.id)"
                        @dragstart="onDragStart(g, $event)"
                      >
                        <span class="drag-dots" aria-hidden="true" />
                        <span class="accent-bar" />
                        <span class="org-card-name">{{ g.name }}</span>
                        <span v-if="g.headcount != null" class="org-card-count">{{ g.headcount }}人</span>
                        <button
                          v-if="g.children?.length"
                          type="button"
                          class="icon-btn"
                          @click.stop="toggleCollapse(g.id)"
                        >
                          {{ isCollapsed(g.id) ? '▸' : '▾' }}
                        </button>
                        <button
                          v-if="canAddChild(g)"
                          type="button"
                          class="icon-btn add"
                          @click.stop="emit('addChild', g.id)"
                        >
                          +
                        </button>
                      </div>

                      <template v-if="g.children?.length && !isCollapsed(g.id)">
                        <div class="org-connector" />
                        <div class="org-children">
                          <div
                            v-for="(gg, ggIdx) in g.children as OrgChartNode[]"
                            :key="gg.id"
                            class="org-branch"
                            @drop="onDropOnParent(g.id, ggIdx, $event)"
                          >
                            <div
                              class="org-card"
                              :class="{
                                'is-selected': selectedId === gg.id,
                                'is-locked': isLocked(gg.id),
                              }"
                              :style="{ '--accent': accentFor(gg, ggIdx) }"
                              draggable="true"
                              @click="emit('select', gg.id)"
                              @dragstart="onDragStart(gg, $event)"
                            >
                              <span class="drag-dots" aria-hidden="true" />
                              <span class="accent-bar" />
                              <span class="org-card-name">{{ gg.name }}</span>
                              <span v-if="gg.headcount != null" class="org-card-count">
                                {{ gg.headcount }}人
                              </span>
                              <button
                                v-if="canAddChild(gg)"
                                type="button"
                                class="icon-btn add"
                                @click.stop="emit('addChild', gg.id)"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <button
                            v-if="canAddChild(g)"
                            type="button"
                            class="org-add-dashed"
                            @click="emit('addChild', g.id)"
                          >
                            + 添加
                          </button>
                        </div>
                      </template>
                    </div>
                    <button
                      v-if="canAddChild(child)"
                      type="button"
                      class="org-add-dashed"
                      @click="emit('addChild', child.id)"
                    >
                      + 添加
                    </button>
                  </div>
                </template>
              </div>
              <button
                v-if="canAddChild(root)"
                type="button"
                class="org-add-dashed"
                @click="emit('addChild', root.id)"
              >
                + 添加
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.org-canvas {
  min-height: 420px;
  height: 100%;
  background:
    radial-gradient(circle at 1px 1px, rgba(59, 130, 246, 0.12) 1px, transparent 0);
  background-size: 16px 16px;
  border-radius: 12px;
  border: 1px solid #e8edf5;
}

.org-canvas-scroll {
  overflow: auto;
  height: 100%;
  min-height: 420px;
  max-height: min(68vh, 640px);
  padding: 28px 32px 40px;
}

.org-flow {
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: max-content;
}

.org-col,
.org-branch {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}

.org-children {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  padding-left: 4px;
}

.org-children::before {
  content: '';
  position: absolute;
  left: -18px;
  top: 22px;
  bottom: 22px;
  width: 2px;
  background: #93c5fd;
}

.org-branch {
  position: relative;
}

.org-branch::before {
  content: '';
  position: absolute;
  left: -22px;
  top: 22px;
  width: 22px;
  height: 2px;
  background: #93c5fd;
}

.org-connector {
  width: 28px;
  height: 2px;
  margin-top: 22px;
  background: #93c5fd;
  flex-shrink: 0;
}

.org-card {
  --accent: #3b82f6;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 188px;
  max-width: 280px;
  padding: 10px 12px 10px 10px;
  background: #fff;
  border: 1px solid #e5eaf3;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  flex-shrink: 0;
}

.org-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.org-card.is-selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
}

.org-card.is-root {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.28);
}

.org-card.is-root.is-selected {
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.25),
    0 8px 20px rgba(59, 130, 246, 0.28);
}

.org-card.is-root .org-card-count,
.org-card.is-root .icon-btn {
  color: rgba(255, 255, 255, 0.95);
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.14);
}

.drag-dots {
  width: 10px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.35;
  background-image: radial-gradient(circle, currentColor 1.2px, transparent 1.3px);
  background-size: 5px 5px;
}

.accent-bar {
  width: 4px;
  align-self: stretch;
  border-radius: 999px;
  background: var(--accent);
  flex-shrink: 0;
}

.org-card-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-card-count {
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
}

.icon-btn {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #3b82f6;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.icon-btn.add {
  font-weight: 700;
}

.org-add-dashed {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 160px;
  height: 40px;
  margin-left: 0;
  border: 1px dashed #93c5fd;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.75);
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
}

.org-add-dashed:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}
</style>
