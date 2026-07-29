<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

const store = useAppStore()

const tableData = computed(() =>
  store.enterprises.map((e) => {
    const reqCount = store.jobRequirements.filter((r) => r.enterpriseId === e.id).length
    const activeReq = store.jobRequirements.filter(
      (r) => r.enterpriseId === e.id && r.status === 'active',
    ).length
    const leadCount = store.recruitmentLeads.filter((l) => l.enterpriseId === e.id).length
    return { ...e, reqCount, activeReq, leadCount }
  }),
)
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">企业管理</h2>
        <p class="text-muted">平台入驻企业一览，关联招聘与任务业务</p>
      </div>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="企业名称" min-width="200" />
      <el-table-column prop="contact" label="联系人" width="120" />
      <el-table-column prop="reqCount" label="岗位需求" width="100" align="center" />
      <el-table-column prop="activeReq" label="招聘中" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.activeReq > 0" type="success" size="small">{{ row.activeReq }}</el-tag>
          <span v-else class="text-muted">0</span>
        </template>
      </el-table-column>
      <el-table-column prop="leadCount" label="跟进线索" width="100" align="center" />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            @click="$router.push({ path: '/recruitment/requirements', query: { ent: row.id } })"
          >
            查看需求
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
