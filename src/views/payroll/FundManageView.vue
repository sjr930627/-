<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  formatFundAmount,
  fundAccountStatusMap,
  fundAccountTypeMap,
  fundTransactionStatusMap,
  fundTransactionTypeMap,
} from '@/constants/fundManage'
import { formatAccountConfigSummary, isIncomeTransaction } from '@/services/fundManagement'
import type { FundAccountType, ProviderFundAccount } from '@/types'

const store = useAppStore()

const providerId = ref('sp_zhongqin')
const activeTab = ref<'accounts' | 'transactions'>('accounts')
const accountDialogVisible = ref(false)
const accountFormRef = ref<FormInstance>()
const editingAccountId = ref<string | null>(null)
const txTypeFilter = ref<'all' | 'alipay' | 'cmb'>('all')
const txKeyword = ref('')

const providerOptions = computed(() =>
  store.serviceProviders.map((item) => ({
    value: item.id,
    label: item.shortName ? `${item.name}（${item.shortName}）` : item.name,
    code: item.code,
    status: item.status,
  })),
)

watch(
  providerOptions,
  (options) => {
    if (!options.some((item) => item.value === providerId.value)) {
      providerId.value = options[0]?.value ?? ''
    }
  },
  { immediate: true },
)

const currentProvider = computed(() =>
  store.serviceProviders.find((item) => item.id === providerId.value),
)

const providerSummary = computed(() => store.getProviderFundSummary(providerId.value))

const allProviderSummaries = computed(() =>
  store.getAllProviderFundSummaries.map((summary) => {
    const provider = store.serviceProviders.find((item) => item.id === summary.providerId)
    return {
      ...summary,
      providerName: provider?.name ?? summary.providerId,
      providerCode: provider?.code ?? '—',
      status: provider?.status ?? 'cooperating',
    }
  }),
)

const accountRows = computed(() =>
  store.getFundAccountsByProvider(providerId.value).map((account) => ({
    ...account,
    typeMeta: fundAccountTypeMap[account.accountType],
    statusMeta: fundAccountStatusMap[account.status],
    configSummary: formatAccountConfigSummary(account),
    balanceLabel: formatFundAmount(account.balance),
  })),
)

const transactionRows = computed(() =>
  store
    .getFundTransactionsByProvider(providerId.value)
    .filter((transaction) => {
      if (txTypeFilter.value !== 'all') {
        const account = store.providerFundAccounts.find((item) => item.id === transaction.accountId)
        if (account?.accountType !== txTypeFilter.value) return false
      }
      if (!txKeyword.value.trim()) return true
      const kw = txKeyword.value.trim().toLowerCase()
      const account = store.providerFundAccounts.find((item) => item.id === transaction.accountId)
      const haystack = [
        transaction.remark,
        transaction.counterparty ?? '',
        transaction.relatedOrderNo ?? '',
        account?.name ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(kw)
    })
    .map((transaction) => {
      const account = store.providerFundAccounts.find((item) => item.id === transaction.accountId)
      const typeMeta = fundTransactionTypeMap[transaction.type]
      const statusMeta = fundTransactionStatusMap[transaction.status]
      const signedAmount = isIncomeTransaction(transaction.type)
        ? transaction.amount
        : -transaction.amount
      return {
        ...transaction,
        accountName: account?.name ?? '—',
        accountTypeLabel: account ? fundAccountTypeMap[account.accountType].label : '—',
        typeMeta,
        statusMeta,
        amountLabel: `${signedAmount >= 0 ? '+' : ''}${formatFundAmount(Math.abs(transaction.amount))}`,
        amountClass: signedAmount >= 0 ? 'amount-in' : 'amount-out',
        balanceLabel: formatFundAmount(transaction.balanceAfter),
        createdAtLabel: new Date(transaction.createdAt).toLocaleString('zh-CN'),
      }
    }),
)

const accountForm = reactive({
  name: '',
  accountType: 'alipay' as FundAccountType,
  status: 'active' as ProviderFundAccount['status'],
  isDefault: false,
  remark: '',
  alipayConfig: {
    appId: '',
    partnerId: '',
    merchantName: '',
    alipayAccount: '',
  },
  cmbConfig: {
    accountName: '',
    accountNo: '',
    branchName: '',
    branchCode: '',
    bankCode: '',
  },
})

const accountRules: FormRules = {
  name: [{ required: true, message: '请输入账户名称', trigger: 'blur' }],
  accountType: [{ required: true, message: '请选择账户类型', trigger: 'change' }],
}

function resetAccountForm() {
  editingAccountId.value = null
  accountForm.name = ''
  accountForm.accountType = 'alipay'
  accountForm.status = 'active'
  accountForm.isDefault = false
  accountForm.remark = ''
  accountForm.alipayConfig = {
    appId: '',
    partnerId: '',
    merchantName: '',
    alipayAccount: '',
  }
  accountForm.cmbConfig = {
    accountName: '',
    accountNo: '',
    branchName: '',
    branchCode: '',
    bankCode: '',
  }
}

function openCreateAccount() {
  resetAccountForm()
  accountDialogVisible.value = true
}

function openEditAccount(account: ProviderFundAccount) {
  editingAccountId.value = account.id
  accountForm.name = account.name
  accountForm.accountType = account.accountType
  accountForm.status = account.status
  accountForm.isDefault = account.isDefault ?? false
  accountForm.remark = account.remark ?? ''
  accountForm.alipayConfig = {
    appId: account.alipayConfig?.appId ?? '',
    partnerId: account.alipayConfig?.partnerId ?? '',
    merchantName: account.alipayConfig?.merchantName ?? '',
    alipayAccount: account.alipayConfig?.alipayAccount ?? '',
  }
  accountForm.cmbConfig = {
    accountName: account.cmbConfig?.accountName ?? '',
    accountNo: account.cmbConfig?.accountNo ?? '',
    branchName: account.cmbConfig?.branchName ?? '',
    branchCode: account.cmbConfig?.branchCode ?? '',
    bankCode: account.cmbConfig?.bankCode ?? '',
  }
  accountDialogVisible.value = true
}

function validateAccountConfig() {
  if (accountForm.accountType === 'alipay') {
    const config = accountForm.alipayConfig
    if (!config.appId || !config.partnerId || !config.merchantName || !config.alipayAccount) {
      ElMessage.warning('请完整填写支付宝账户参数')
      return false
    }
  } else {
    const config = accountForm.cmbConfig
    if (!config.accountName || !config.accountNo || !config.branchName || !config.branchCode || !config.bankCode) {
      ElMessage.warning('请完整填写招商银行开户参数')
      return false
    }
  }
  return true
}

async function saveAccount() {
  if (!providerId.value) return
  const valid = await accountFormRef.value?.validate().catch(() => false)
  if (!valid || !validateAccountConfig()) return

  store.upsertProviderFundAccount({
    id: editingAccountId.value ?? undefined,
    providerId: providerId.value,
    name: accountForm.name.trim(),
    accountType: accountForm.accountType,
    status: accountForm.status,
    isDefault: accountForm.isDefault,
    remark: accountForm.remark.trim() || undefined,
    alipayConfig:
      accountForm.accountType === 'alipay'
        ? { ...accountForm.alipayConfig }
        : undefined,
    cmbConfig:
      accountForm.accountType === 'cmb'
        ? { ...accountForm.cmbConfig }
        : undefined,
  })
  ElMessage.success(editingAccountId.value ? '账户已更新' : '账户已新增')
  accountDialogVisible.value = false
}

function selectProvider(id: string) {
  providerId.value = id
}
</script>

<template>
  <div class="fund-manage-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">资金管理</h2>
        <p class="text-muted">查看服务商资金账户余额、资金流水及灵工待领取汇总</p>
      </div>
      <el-button type="primary" @click="openCreateAccount">
        <el-icon><Plus /></el-icon>
        新增账户
      </el-button>
    </div>

    <div class="page-card provider-overview-card">
      <div class="card-title">服务商资金概览</div>
      <el-table :data="allProviderSummaries" border stripe size="small">
        <el-table-column prop="providerCode" label="服务商编号" width="130" />
        <el-table-column prop="providerName" label="服务商名称" min-width="200" />
        <el-table-column label="账户数" width="80" align="center">
          <template #default="{ row }">{{ row.accountCount }}</template>
        </el-table-column>
        <el-table-column label="账户总余额" width="140" align="right">
          <template #default="{ row }">{{ formatFundAmount(row.totalBalance) }}</template>
        </el-table-column>
        <el-table-column label="灵工待领取汇总" width="150" align="right">
          <template #default="{ row }">
            <span class="pending-amount">{{ formatFundAmount(row.pendingClaimable) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button link type="primary" @click="selectProvider(row.providerId)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="page-card filter-card">
      <div class="filter-row">
        <span class="filter-label">当前服务商</span>
        <el-select v-model="providerId" style="width: 320px">
          <el-option
            v-for="item in providerOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <span v-if="currentProvider" class="provider-code">{{ currentProvider.code }}</span>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">账户总余额</div>
        <div class="summary-value">{{ formatFundAmount(providerSummary.totalBalance) }}</div>
        <div class="summary-sub">{{ providerSummary.accountCount }} 个资金账户</div>
      </div>
      <div class="summary-card highlight">
        <div class="summary-label">灵工待领取汇总</div>
        <div class="summary-value pending">{{ formatFundAmount(providerSummary.pendingClaimable) }}</div>
        <div class="summary-sub">该服务商关联企业下灵工待领取总额</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">可用资金覆盖率</div>
        <div class="summary-value">
          {{
            providerSummary.pendingClaimable > 0
              ? `${Math.min(999, Math.round((providerSummary.totalBalance / providerSummary.pendingClaimable) * 100))}%`
              : '—'
          }}
        </div>
        <div class="summary-sub">账户余额 / 待领取金额</div>
      </div>
    </div>

    <div class="page-card detail-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="资金账户" name="accounts">
          <el-table :data="accountRows" border stripe empty-text="该服务商暂无资金账户">
            <el-table-column prop="name" label="账户名称" min-width="180" />
            <el-table-column label="账户类型" width="110">
              <template #default="{ row }">
                <el-tag size="small" :style="{ color: row.typeMeta.color, borderColor: row.typeMeta.color }">
                  {{ row.typeMeta.label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="balanceLabel" label="账户余额" width="140" align="right" />
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.statusMeta.type">{{ row.statusMeta.label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="账户参数" min-width="240">
              <template #default="{ row }">
                <div class="config-summary">{{ row.configSummary }}</div>
                <div v-if="row.accountType === 'alipay' && row.alipayConfig" class="config-detail text-muted">
                  AppID {{ row.alipayConfig.appId }} · PID {{ row.alipayConfig.partnerId }}
                </div>
                <div v-if="row.accountType === 'cmb' && row.cmbConfig" class="config-detail text-muted">
                  {{ row.cmbConfig.branchName }} · 联行号 {{ row.cmbConfig.bankCode }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="默认" width="70" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.isDefault" size="small" type="success">默认</el-tag>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEditAccount(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="资金流水" name="transactions">
          <div class="tx-toolbar">
            <el-input
              v-model="txKeyword"
              placeholder="搜索流水备注、对手方、单号..."
              clearable
              prefix-icon="Search"
              style="width: 280px"
            />
            <el-select v-model="txTypeFilter" style="width: 140px">
              <el-option label="全部账户类型" value="all" />
              <el-option label="支付宝" value="alipay" />
              <el-option label="招商银行" value="cmb" />
            </el-select>
          </div>
          <el-table :data="transactionRows" border stripe empty-text="暂无资金流水">
            <el-table-column prop="createdAtLabel" label="时间" width="170" />
            <el-table-column prop="accountName" label="账户" min-width="160" />
            <el-table-column prop="accountTypeLabel" label="账户类型" width="100" />
            <el-table-column label="类型" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ row.typeMeta.label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="130" align="right">
              <template #default="{ row }">
                <span :class="row.amountClass">{{ row.amountLabel }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="balanceLabel" label="余额" width="130" align="right" />
            <el-table-column prop="counterparty" label="对手方" min-width="140" show-overflow-tooltip />
            <el-table-column prop="relatedOrderNo" label="关联单号" width="160" show-overflow-tooltip />
            <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.statusMeta.type">{{ row.statusMeta.label }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog
      v-model="accountDialogVisible"
      :title="editingAccountId ? '编辑资金账户' : '新增资金账户'"
      width="640px"
      destroy-on-close
      @closed="resetAccountForm"
    >
      <el-form ref="accountFormRef" :model="accountForm" :rules="accountRules" label-width="110px">
        <el-form-item label="账户名称" prop="name">
          <el-input v-model="accountForm.name" placeholder="如：中秦灵工支付宝主账户" />
        </el-form-item>
        <el-form-item label="账户类型" prop="accountType">
          <el-radio-group v-model="accountForm.accountType">
            <el-radio value="alipay">支付宝</el-radio>
            <el-radio value="cmb">招商银行</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="账户状态">
          <el-radio-group v-model="accountForm.status">
            <el-radio value="active">正常</el-radio>
            <el-radio value="frozen">冻结</el-radio>
            <el-radio value="disabled">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="默认账户">
          <el-switch v-model="accountForm.isDefault" />
        </el-form-item>

        <template v-if="accountForm.accountType === 'alipay'">
          <div class="form-section-title">支付宝参数</div>
          <el-form-item label="AppID">
            <el-input v-model="accountForm.alipayConfig.appId" placeholder="2021003123456789" />
          </el-form-item>
          <el-form-item label="Partner ID">
            <el-input v-model="accountForm.alipayConfig.partnerId" placeholder="2088123456789012" />
          </el-form-item>
          <el-form-item label="商户名称">
            <el-input v-model="accountForm.alipayConfig.merchantName" placeholder="企业/商户全称" />
          </el-form-item>
          <el-form-item label="支付宝账号">
            <el-input v-model="accountForm.alipayConfig.alipayAccount" placeholder="service@example.com" />
          </el-form-item>
        </template>

        <template v-else>
          <div class="form-section-title">招商银行开户参数</div>
          <el-form-item label="开户名称">
            <el-input v-model="accountForm.cmbConfig.accountName" placeholder="对公账户名称" />
          </el-form-item>
          <el-form-item label="银行账号">
            <el-input v-model="accountForm.cmbConfig.accountNo" placeholder="7559 1234 5678 901" />
          </el-form-item>
          <el-form-item label="开户支行">
            <el-input v-model="accountForm.cmbConfig.branchName" placeholder="招商银行西安高新支行" />
          </el-form-item>
          <el-form-item label="支行代码">
            <el-input v-model="accountForm.cmbConfig.branchCode" placeholder="755901" />
          </el-form-item>
          <el-form-item label="联行号">
            <el-input v-model="accountForm.cmbConfig.bankCode" placeholder="308584000013" />
          </el-form-item>
        </template>

        <el-form-item label="备注">
          <el-input v-model="accountForm.remark" type="textarea" :rows="2" placeholder="账户用途说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="accountDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAccount">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.fund-manage-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.page-title {
  margin: 0 0 4px;
}

.provider-overview-card,
.filter-card,
.detail-card {
  padding: 16px 20px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-label {
  font-size: 14px;
  color: #606266;
}

.provider-code {
  font-size: 13px;
  color: #909399;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.summary-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

.summary-card.highlight {
  background: linear-gradient(135deg, #fff7ed 0%, #fff 100%);
  border: 1px solid #fed7aa;
}

.summary-label {
  font-size: 13px;
  color: #909399;
}

.summary-value {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 700;
  color: #1f2329;
}

.summary-value.pending {
  color: #ea580c;
}

.summary-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

.pending-amount {
  color: #ea580c;
  font-weight: 600;
}

.config-summary {
  font-size: 13px;
  color: #303133;
}

.config-detail {
  margin-top: 4px;
  font-size: 12px;
}

.tx-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.amount-in {
  color: #16a34a;
  font-weight: 600;
}

.amount-out {
  color: #dc2626;
  font-weight: 600;
}

.form-section-title {
  margin: 8px 0 12px;
  padding-left: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  border-left: 3px solid #2563eb;
}
</style>
