<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePortal } from '@/composables/usePortal'
import { useAppStore } from '@/stores/app'
import TenantManagementTab from '@/components/system/TenantManagementTab.vue'
import EnterpriseTenantAccountsPanel from '@/components/system/EnterpriseTenantAccountsPanel.vue'
import OpsPersonnelTab from '@/components/system/OpsPersonnelTab.vue'

const route = useRoute()
const router = useRouter()
const { isPlatform, isEnterprise } = usePortal()
const store = useAppStore()

const activeTab = ref<'tenant' | 'ops'>('tenant')
const tenantEnterpriseId = ref<string | null>(null)

watch(
  () => route.query.tenant,
  (id) => {
    tenantEnterpriseId.value = typeof id === 'string' ? id : null
  },
  { immediate: true },
)

const pageTitle = computed(() => {
  if (tenantEnterpriseId.value) return '企业账号管理'
  return isEnterprise.value ? '账号管理' : '账号管理'
})

function enterTenantAccounts(enterpriseId: string) {
  router.push({ path: '/system/accounts', query: { tenant: enterpriseId } })
}

function backToTenantList() {
  router.push({ path: '/system/accounts' })
}
</script>

<template>
  <div class="account-shell page-card">
    <template v-if="isPlatform && tenantEnterpriseId">
      <EnterpriseTenantAccountsPanel
        :enterprise-id="tenantEnterpriseId"
        @back="backToTenantList"
      />
    </template>

    <template v-else-if="isPlatform">
      <div class="shell-header">
        <div>
          <h2 class="page-title">{{ pageTitle }}</h2>
          <p class="text-muted">租户管理与运营内部人员账号</p>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="account-tabs">
        <el-tab-pane label="租户管理" name="tenant">
          <TenantManagementTab @edit-accounts="enterTenantAccounts" />
        </el-tab-pane>
        <el-tab-pane label="运营内部人员" name="ops">
          <OpsPersonnelTab scope="platform" />
        </el-tab-pane>
      </el-tabs>
    </template>

    <template v-else-if="isEnterprise">
      <div class="shell-header">
        <div>
          <h2 class="page-title">账号管理</h2>
          <p class="text-muted">管理本企业端登录账号与角色分配</p>
        </div>
      </div>
      <OpsPersonnelTab scope="enterprise" :enterprise-id="store.currentEnterpriseId" />
    </template>
  </div>
</template>

<style scoped>
.account-shell {
  min-height: calc(100vh - 140px);
  padding: 16px 20px;
}

.shell-header {
  margin-bottom: 12px;
}

.shell-header .page-title {
  margin: 0 0 4px;
}

.account-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}
</style>
