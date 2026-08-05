<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ElTree } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  buildDepartmentTree,
  getDepartmentDescendantIds,
  getDepartmentName,
} from '@/utils'
import { enterpriseOperatorRoleId } from '@/constants/enterprise'
import { accountHasRole } from '@/constants/account'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [string[]]
}>()

const store = useAppStore()
const treeRef = ref<InstanceType<typeof ElTree>>()
const treeKeyword = ref('')
const selectedDeptId = ref('dept_root')

const treeData = computed(() => buildDepartmentTree(store.departments))

const selectedDept = computed(() =>
  store.departments.find((d) => d.id === selectedDeptId.value),
)

const operatorAccounts = computed(() => {
  if (!selectedDeptId.value) return []
  const ids = getDepartmentDescendantIds(store.departments, selectedDeptId.value)
  return store.systemAccounts
    .filter(
      (a) =>
        ids.has(a.departmentId) &&
        accountHasRole(a, enterpriseOperatorRoleId) &&
        a.status === 'enabled',
    )
    .map((a) => ({
      ...a,
      departmentName: getDepartmentName(store.departments, a.departmentId),
      checked: props.modelValue.includes(a.id),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-CN'))
})

const selectedOwners = computed(() =>
  props.modelValue
    .map((id) => store.systemAccounts.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a)),
)

watch(treeKeyword, (val) => {
  treeRef.value?.filter(val)
})

function filterTreeNode(value: string, data: { name: string }) {
  if (!value) return true
  return data.name.includes(value)
}

function handleNodeClick(data: { id: string }) {
  selectedDeptId.value = data.id
}

function toggleAccount(id: string) {
  if (props.disabled) return
  const next = [...props.modelValue]
  const idx = next.indexOf(id)
  if (idx >= 0) next.splice(idx, 1)
  else next.push(id)
  emit('update:modelValue', next)
}

function removeOwner(id: string) {
  if (props.disabled) return
  emit(
    'update:modelValue',
    props.modelValue.filter((item) => item !== id),
  )
}
</script>

<template>
  <div class="enterprise-owner-picker">
    <div v-if="selectedOwners.length" class="selected-bar">
      <span class="selected-label">已选 {{ selectedOwners.length }} 人</span>
      <div class="selected-tags">
        <el-tag
          v-for="owner in selectedOwners"
          :key="owner.id"
          size="small"
          :closable="!disabled"
          @close="removeOwner(owner.id)"
        >
          {{ owner.displayName }}
        </el-tag>
      </div>
    </div>
    <div v-else class="selected-empty">暂未选择企业负责人</div>

    <div class="picker-layout">
      <div class="org-panel">
        <div class="panel-title">组织架构树</div>
        <el-input
          v-model="treeKeyword"
          placeholder="搜索部门"
          clearable
          prefix-icon="Search"
          class="org-search"
          :disabled="disabled"
        />
        <el-tree
          ref="treeRef"
          :data="treeData"
          node-key="id"
          default-expand-all
          highlight-current
          :current-node-key="selectedDeptId"
          :expand-on-click-node="false"
          :filter-node-method="filterTreeNode"
          @node-click="handleNodeClick"
        >
          <template #default="{ data }">
            <span class="tree-name">{{ data.name }}</span>
          </template>
        </el-tree>
      </div>

      <div class="operator-panel">
        <div class="panel-title">
          操作员
          <span v-if="selectedDept" class="panel-sub">（{{ selectedDept.name }}及下级）</span>
        </div>
        <div v-if="operatorAccounts.length" class="operator-list">
          <label
            v-for="account in operatorAccounts"
            :key="account.id"
            class="operator-item"
            :class="{ checked: account.checked, disabled }"
          >
            <input
              type="checkbox"
              :checked="account.checked"
              :disabled="disabled"
              @change="toggleAccount(account.id)"
            >
            <div class="operator-main">
              <div class="operator-name">{{ account.displayName }}</div>
              <div class="operator-meta">
                {{ account.departmentName }}
                <span v-if="account.phone"> · {{ account.phone }}</span>
              </div>
            </div>
          </label>
        </div>
        <el-empty v-else description="当前部门及下级暂无可用操作员" :image-size="72" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.enterprise-owner-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.selected-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.selected-label {
  font-size: 13px;
  color: #64748b;
  line-height: 24px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.selected-empty {
  font-size: 13px;
  color: #94a3b8;
  padding: 8px 0;
}

.picker-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 12px;
  min-height: 320px;
}

.org-panel,
.operator-panel {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

.panel-sub {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}

.org-search {
  margin-bottom: 10px;
}

.tree-name {
  font-size: 13px;
}

.operator-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow: auto;
}

.operator-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.operator-item:hover:not(.disabled) {
  border-color: #c6e2ff;
  background: #f5faff;
}

.operator-item.checked {
  border-color: #409eff;
  background: #ecf5ff;
}

.operator-item.disabled {
  cursor: default;
}

.operator-main {
  flex: 1;
  min-width: 0;
}

.operator-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.operator-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.org-panel :deep(.el-tree) {
  max-height: 360px;
  overflow: auto;
}

@media (max-width: 960px) {
  .picker-layout {
    grid-template-columns: 1fr;
  }
}
</style>
