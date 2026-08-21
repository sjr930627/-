<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { ElTree } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { buildDepartmentTree, getDepartmentName } from '@/utils'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const enterpriseId = computed(() => route.params.id as string)
const enterprise = computed(() => store.enterprises.find((e) => e.id === enterpriseId.value))

const treeRef = ref<InstanceType<typeof ElTree>>()
const checkedKeys = ref<string[]>([])
const filterKeyword = ref('')

const treeData = computed(() => buildDepartmentTree(store.departments))

const authorizedNames = computed(() =>
  checkedKeys.value
    .map((id) => getDepartmentName(store.departments, id))
    .filter(Boolean),
)

watch(
  enterprise,
  async (ent) => {
    checkedKeys.value = [...(ent?.authorizedDepartmentIds ?? [])]
    await nextTick()
    treeRef.value?.setCheckedKeys(checkedKeys.value)
  },
  { immediate: true },
)

function filterNode(value: string, data: { label?: string; name?: string }) {
  if (!value) return true
  const label = data.label || data.name || ''
  return label.includes(value)
}

watch(filterKeyword, (val) => {
  treeRef.value?.filter(val)
})

function onCheck() {
  checkedKeys.value = (treeRef.value?.getCheckedKeys(false) as string[]) ?? []
}

function selectAll() {
  const ids = store.departments.map((d) => d.id)
  checkedKeys.value = ids
  treeRef.value?.setCheckedKeys(ids)
}

function clearAll() {
  checkedKeys.value = []
  treeRef.value?.setCheckedKeys([])
}

function save() {
  if (!enterprise.value) return
  store.updateEnterpriseAuthorizedDepartments(enterpriseId.value, checkedKeys.value)
  ElMessage.success('企业数据授权已保存')
  router.push('/enterprises')
}

function cancel() {
  router.push('/enterprises')
}
</script>

<template>
  <div v-if="enterprise" class="authorize-page">
    <div class="page-breadcrumb-row">
      <el-breadcrumb separator=">">
        <el-breadcrumb-item>企业管理</el-breadcrumb-item>
        <el-breadcrumb-item>
          <a @click.prevent="cancel">企业列表</a>
        </el-breadcrumb-item>
        <el-breadcrumb-item>企业授权</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="header-actions">
        <el-button @click="cancel">取消</el-button>
        <el-button type="primary" @click="save">保存授权</el-button>
      </div>
    </div>

    <div class="page-card summary-card">
      <h2 class="page-title">企业数据授权</h2>
      <p class="text-muted">
        将「{{ enterprise.name }}」的数据授权给对应组织部门，被授权部门及其人员可访问该企业相关数据。
      </p>
      <div class="meta-row">
        <span>企业编号：{{ enterprise.code }}</span>
        <span>简称：{{ enterprise.shortName }}</span>
        <span>已选部门：{{ checkedKeys.length }} 个</span>
      </div>
    </div>

    <div class="layout">
      <section class="page-card tree-card">
        <div class="tree-toolbar">
          <el-input
            v-model="filterKeyword"
            clearable
            placeholder="搜索部门"
            prefix-icon="Search"
            style="width: 220px"
          />
          <div class="tree-actions">
            <el-button text type="primary" @click="selectAll">全选</el-button>
            <el-button text @click="clearAll">清空</el-button>
          </div>
        </div>
        <el-tree
          ref="treeRef"
          :data="treeData"
          node-key="id"
          show-checkbox
          default-expand-all
          :props="{ label: 'name', children: 'children' }"
          :filter-node-method="filterNode"
          @check="onCheck"
        />
      </section>

      <section class="page-card side-card">
        <h3 class="side-title">已授权部门</h3>
        <div v-if="authorizedNames.length" class="tag-list">
          <el-tag v-for="name in authorizedNames" :key="name" class="dept-tag">{{ name }}</el-tag>
        </div>
        <el-empty v-else description="尚未选择授权部门" :image-size="72" />
        <p class="hint">
          提示：授权后，该部门下的平台操作员在数据范围允许时可见本企业数据（演示配置）。
        </p>
      </section>
    </div>
  </div>
  <el-empty v-else description="企业不存在" class="page-card" />
</template>

<style scoped>
.authorize-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-breadcrumb-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.summary-card {
  padding: 18px 20px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 10px;
  font-size: 13px;
  color: #606266;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.8fr);
  gap: 12px;
}

.tree-card,
.side-card {
  padding: 16px 18px;
  min-height: 420px;
}

.tree-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.tree-actions {
  display: flex;
  gap: 4px;
}

.side-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 650;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dept-tag {
  margin: 0;
}

.hint {
  margin-top: 16px;
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
}

@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
