<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { buildDepartmentTree, getDepartmentDescendantIds } from '@/utils'
import { DEFAULT_WORKFORCE_ENTERPRISE_ID, isUnassignedDepartment } from '@/constants/department'
import { enterpriseOperatorRoleId } from '@/constants/enterprise'
import { accountHasRole } from '@/constants/account'
import type { DepartmentTreeNode } from '@/types'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    placeholder?: string
  }>(),
  {
    placeholder: '按负责人搜索 / 部门级联选择',
  },
)

const emit = defineEmits<{
  'update:modelValue': [string[]]
}>()

const store = useAppStore()

interface OwnerTreeNode {
  id: string
  label: string
  isDept?: boolean
  meta?: string
  searchText?: string
  children?: OwnerTreeNode[]
}

/** 运营后台权限组织（非企业灵工部门树） */
const platformDepartments = computed(() =>
  store
    .getDepartmentsByEnterprise(DEFAULT_WORKFORCE_ENTERPRISE_ID)
    .filter((d) => !isUnassignedDepartment(d.id)),
)

/** 运营后台权限账号中的企业操作员 */
const operatorAccounts = computed(() =>
  store.systemAccounts
    .filter(
      (a) =>
        accountHasRole(a, enterpriseOperatorRoleId) &&
        a.status === 'enabled' &&
        a.accountPortal !== 'enterprise' &&
        !a.enterpriseId,
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-CN')),
)

const personIdSet = computed(() => new Set(operatorAccounts.value.map((a) => a.id)))

const ownerTree = computed((): OwnerTreeNode[] => {
  const byDept = new Map<string, typeof operatorAccounts.value>()
  for (const account of operatorAccounts.value) {
    const deptId = account.departmentId || '__none__'
    const list = byDept.get(deptId) ?? []
    list.push(account)
    byDept.set(deptId, list)
  }

  const toPersonNode = (account: (typeof operatorAccounts.value)[number]): OwnerTreeNode => ({
    id: account.id,
    label: account.displayName,
    meta: account.phone || account.username,
    searchText: `${account.displayName} ${account.username} ${account.phone ?? ''}`.toLowerCase(),
  })

  const mapDept = (node: DepartmentTreeNode): OwnerTreeNode | null => {
    const childDepts = node.children.map(mapDept).filter((n): n is OwnerTreeNode => Boolean(n))
    const people = (byDept.get(node.id) ?? []).map(toPersonNode)
    byDept.delete(node.id)
    if (!childDepts.length && !people.length) return null
    return {
      id: `dept:${node.id}`,
      label: node.name,
      isDept: true,
      searchText: node.name.toLowerCase(),
      children: [...childDepts, ...people],
    }
  }

  const roots = buildDepartmentTree(platformDepartments.value)
    .map(mapDept)
    .filter((n): n is OwnerTreeNode => Boolean(n))

  const leftovers = [...byDept.values()].flat().map(toPersonNode)
  if (leftovers.length) {
    roots.push({
      id: 'dept:__unassigned__',
      label: '未分配部门',
      isDept: true,
      searchText: '未分配部门',
      children: leftovers,
    })
  }

  return roots
})

/** 部门节点 → 该部门及下级下全部操作员 */
function personIdsUnderDept(deptId: string): string[] {
  if (deptId === '__unassigned__') {
    const known = new Set(platformDepartments.value.map((d) => d.id))
    return operatorAccounts.value
      .filter((a) => !a.departmentId || !known.has(a.departmentId))
      .map((a) => a.id)
  }
  const ids = getDepartmentDescendantIds(platformDepartments.value, deptId)
  return operatorAccounts.value.filter((a) => ids.has(a.departmentId)).map((a) => a.id)
}

function filterNode(keyword: string, data: OwnerTreeNode) {
  if (!keyword) return true
  const kw = keyword.trim().toLowerCase()
  if (!kw) return true
  if (data.label.toLowerCase().includes(kw)) return true
  if (data.searchText?.includes(kw)) return true
  return false
}

/** 勾选部门时展开为该部门（含下级）全部人员；人员节点原样保留 */
function normalizeToPersonIds(raw: string[] | string | null): string[] {
  const next = Array.isArray(raw) ? raw : raw ? [raw] : []
  const personIds = new Set<string>()

  for (const id of next) {
    if (String(id).startsWith('dept:')) {
      for (const pid of personIdsUnderDept(String(id).slice('dept:'.length))) {
        personIds.add(pid)
      }
      continue
    }
    if (personIdSet.value.has(id)) personIds.add(id)
  }

  return [...personIds]
}

function onSelectChange(ids: string[] | string | null) {
  emit('update:modelValue', normalizeToPersonIds(ids))
}
</script>

<template>
  <el-tree-select
    :model-value="modelValue"
    :data="ownerTree"
    multiple
    filterable
    clearable
    collapse-tags
    collapse-tags-tooltip
    show-checkbox
    default-expand-all
    :render-after-expand="false"
    :filter-node-method="filterNode"
    :props="{ value: 'id', label: 'label', children: 'children' }"
    :placeholder="placeholder"
    class="owner-tree-select"
    @update:model-value="onSelectChange"
  >
    <template #default="{ data }">
      <span class="tree-node" :class="{ 'is-dept': data.isDept }">
        <span class="tree-label">{{ data.label }}</span>
        <span v-if="data.meta" class="tree-meta">{{ data.meta }}</span>
      </span>
    </template>
  </el-tree-select>
</template>

<style scoped>
.owner-tree-select {
  width: 100%;
}

.tree-node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.tree-node.is-dept .tree-label {
  color: #606266;
  font-weight: 600;
}

.tree-meta {
  color: #909399;
  font-size: 12px;
}
</style>
