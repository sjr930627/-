<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  billRemainingInvoiceAmount,
  formatMoney,
  invoiceStatusMap,
  invoiceTypeMap,
} from '@/constants/payrollBill'
import type { InvoiceType } from '@/types'

const store = useAppStore()
const route = useRoute()

const applyVisible = ref(false)
const detailVisible = ref(false)
const viewingId = ref<string | null>(null)

const form = ref({
  billId: '',
  invoiceType: 'special' as InvoiceType,
  title: '华信通信服务有限公司',
  taxNo: '91610131MA6TXY8X1K',
  amount: 0,
  recipientName: '',
  recipientPhone: '',
  recipientAddress: '',
  email: '',
})

const invoiceableBills = computed(() =>
  store.settlementBills.filter((b) => b.status === 'paid' && billRemainingInvoiceAmount(b) > 0),
)

const tableData = computed(() =>
  store.invoiceApplications.map((inv) => ({
    ...inv,
    typeLabel: invoiceTypeMap[inv.invoiceType],
    amountLabel: formatMoney(inv.amount),
    statusLabel: invoiceStatusMap[inv.status].label,
    statusType: invoiceStatusMap[inv.status].type,
    timeLabel: new Date(inv.createdAt).toLocaleString('zh-CN'),
  })),
)

const viewingInvoice = computed(() =>
  viewingId.value ? store.invoiceApplications.find((i) => i.id === viewingId.value) : null,
)

onMounted(() => {
  const billId = route.query.billId
  if (typeof billId === 'string') {
    openApply(billId)
  }
})

function openApply(billId?: string) {
  const bill = billId
    ? store.settlementBills.find((b) => b.id === billId)
    : invoiceableBills.value[0]
  if (!bill) {
    ElMessage.warning('暂无可申请发票的账单')
    return
  }
  form.value = {
    billId: bill.id,
    invoiceType: 'special',
    title: bill.enterpriseName,
    taxNo: '91610131MA6TXY8X1K',
    amount: billRemainingInvoiceAmount(bill),
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    email: '',
  }
  applyVisible.value = true
}

function onBillChange(billId: string) {
  const bill = store.settlementBills.find((b) => b.id === billId)
  if (bill) {
    form.value.title = bill.enterpriseName
    form.value.amount = billRemainingInvoiceAmount(bill)
  }
}

function submitApply() {
  const bill = store.settlementBills.find((b) => b.id === form.value.billId)
  if (!bill) return
  if (form.value.invoiceType === 'special' && !form.value.email && !form.value.recipientAddress) {
    ElMessage.warning('请填写电子发票邮箱或纸质发票收件信息')
    return
  }
  try {
    store.applyInvoice({
      billId: bill.id,
      billNo: bill.billNo,
      enterpriseId: bill.enterpriseId,
      enterpriseName: bill.enterpriseName,
      invoiceType: form.value.invoiceType,
      title: form.value.title,
      taxNo: form.value.taxNo,
      amount: form.value.amount,
      recipientName: form.value.recipientName || undefined,
      recipientPhone: form.value.recipientPhone || undefined,
      recipientAddress: form.value.recipientAddress || undefined,
      email: form.value.email || undefined,
    })
    applyVisible.value = false
    ElMessage.success('发票申请已提交')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败')
  }
}

function openDetail(id: string) {
  viewingId.value = id
  detailVisible.value = true
}

function downloadInvoice(row: { electronicUrl?: string; applicationNo: string }) {
  if (row.electronicUrl) {
    ElMessage.success(`正在下载 ${row.applicationNo} 电子发票（演示）`)
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">发票管理</h2>
        <p class="text-muted">对已支付账单申请开具发票，跟踪开票进度</p>
      </div>
      <el-button type="primary" @click="openApply()">申请发票</el-button>
    </div>

    <el-table :data="tableData" border stripe empty-text="暂无发票申请">
      <el-table-column prop="applicationNo" label="发票申请编号" width="160" />
      <el-table-column prop="billNo" label="关联账单编号" width="160" />
      <el-table-column prop="typeLabel" label="发票类型" width="140" />
      <el-table-column prop="amountLabel" label="发票金额" width="130" align="right" />
      <el-table-column prop="timeLabel" label="申请时间" width="170" />
      <el-table-column label="开票状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.statusType">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row.id)">查看详情</el-button>
          <el-button
            v-if="row.status === 'issued' && row.electronicUrl"
            link
            @click="downloadInvoice(row)"
          >
            下载电子发票
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="applyVisible" title="申请发票" width="560px" destroy-on-close>
    <el-form label-width="110px">
      <el-form-item label="关联账单" required>
        <el-select v-model="form.billId" style="width: 100%" @change="onBillChange">
          <el-option
            v-for="b in invoiceableBills"
            :key="b.id"
            :label="`${b.billNo}（剩余 ${formatMoney(billRemainingInvoiceAmount(b))}）`"
            :value="b.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="发票类型" required>
        <el-radio-group v-model="form.invoiceType">
          <el-radio value="special">增值税专用发票</el-radio>
          <el-radio value="normal">增值税普通发票</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="发票抬头" required>
        <el-input v-model="form.title" />
      </el-form-item>
      <el-form-item label="税号" required>
        <el-input v-model="form.taxNo" />
      </el-form-item>
      <el-form-item label="发票金额" required>
        <el-input-number v-model="form.amount" :min="0.01" :precision="2" style="width: 100%" />
        <p class="field-tip">默认账单剩余可开金额，支持分次开票</p>
      </el-form-item>
      <el-divider content-position="left">收件信息</el-divider>
      <el-form-item label="电子邮箱">
        <el-input v-model="form.email" placeholder="电子发票接收邮箱" />
      </el-form-item>
      <el-form-item label="收件人">
        <el-input v-model="form.recipientName" placeholder="纸质发票" />
      </el-form-item>
      <el-form-item label="联系电话">
        <el-input v-model="form.recipientPhone" />
      </el-form-item>
      <el-form-item label="收件地址">
        <el-input v-model="form.recipientAddress" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="applyVisible = false">取消</el-button>
      <el-button type="primary" @click="submitApply">提交申请</el-button>
    </template>
  </el-dialog>

  <el-drawer v-model="detailVisible" title="发票申请详情" size="480px">
    <template v-if="viewingInvoice">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="申请编号">{{ viewingInvoice.applicationNo }}</el-descriptions-item>
        <el-descriptions-item label="关联账单">{{ viewingInvoice.billNo }}</el-descriptions-item>
        <el-descriptions-item label="发票类型">
          {{ invoiceTypeMap[viewingInvoice.invoiceType] }}
        </el-descriptions-item>
        <el-descriptions-item label="发票抬头">{{ viewingInvoice.title }}</el-descriptions-item>
        <el-descriptions-item label="税号">{{ viewingInvoice.taxNo }}</el-descriptions-item>
        <el-descriptions-item label="发票金额">
          {{ formatMoney(viewingInvoice.amount) }}
        </el-descriptions-item>
        <el-descriptions-item label="开票状态">
          {{ invoiceStatusMap[viewingInvoice.status].label }}
        </el-descriptions-item>
        <el-descriptions-item v-if="viewingInvoice.email" label="邮箱">
          {{ viewingInvoice.email }}
        </el-descriptions-item>
        <el-descriptions-item v-if="viewingInvoice.recipientAddress" label="收件地址">
          {{ viewingInvoice.recipientName }} {{ viewingInvoice.recipientPhone }}
          {{ viewingInvoice.recipientAddress }}
        </el-descriptions-item>
        <el-descriptions-item v-if="viewingInvoice.expressNo" label="快递单号">
          {{ viewingInvoice.expressNo }}
        </el-descriptions-item>
      </el-descriptions>
    </template>
  </el-drawer>
</template>

<style scoped>
.field-tip {
  margin: 6px 0 0;
  font-size: 12px;
  color: #909399;
}
</style>
