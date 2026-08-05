import { calcNetAfterTax, calcWithholdingTax } from '@/constants/taxManage'
import type { TaxDeclaration, TaxWithdrawalChannel } from '@/types'

function line(
  id: string,
  withdrawalNo: string,
  channel: TaxWithdrawalChannel,
  amount: number,
  withdrawnAt: string,
) {
  const taxAmount = calcWithholdingTax(amount)
  return {
    id,
    withdrawalNo,
    channel,
    settlementAmount: amount,
    taxAmount,
    netAmount: calcNetAfterTax(amount),
    withdrawnAt,
  }
}

function worker(
  employeeId: string,
  employeeName: string,
  phone: string,
  idCardNo: string,
  withdrawals: ReturnType<typeof line>[],
) {
  return {
    employeeId,
    employeeName,
    phone,
    idCardNo,
    totalSettlementAmount: withdrawals.reduce((sum, item) => sum + item.settlementAmount, 0),
    totalTaxAmount: withdrawals.reduce((sum, item) => sum + item.taxAmount, 0),
    totalNetAmount: withdrawals.reduce((sum, item) => sum + item.netAmount, 0),
    withdrawals,
  }
}

const zhongqinJulyWorkers = [
  worker('emp_001', '张伟', '13800001001', '6101**********1234', [
    line('txw_001', 'WD202607050001', 'alipay', 4400, '2026-07-05T10:00:00.000Z'),
  ]),
  worker('emp_002', '李娜', '13800001002', '6101**********5678', [
    line('txw_002', 'WD202607050002', 'bank_card', 4200, '2026-07-05T10:00:00.000Z'),
  ]),
  worker('emp_003', '王强', '13800001003', '6101**********9012', [
    line('txw_003', 'WD202607050003', 'alipay', 4400, '2026-07-05T10:00:00.000Z'),
  ]),
  worker('emp_008', '周杰', '13800001008', '6101**********3456', [
    line('txw_004', 'WD202607030001', 'bank_card', 1920, '2026-07-03T09:00:00.000Z'),
  ]),
  worker('emp_009', '吴婷', '13800001009', '6101**********7890', [
    line('txw_005', 'WD202607030002', 'alipay', 1440, '2026-07-03T09:00:00.000Z'),
  ]),
]

export const seedTaxDeclarations: TaxDeclaration[] = [
  {
    id: 'taxd_001',
    declarationNo: 'TAX-202607-SP-ZQ-001',
    serviceProviderId: 'sp_zhongqin',
    serviceProviderName: '中秦灵活用工服务有限公司',
    month: '2026-07',
    workerCount: zhongqinJulyWorkers.length,
    totalSettlementAmount: zhongqinJulyWorkers.reduce((sum, item) => sum + item.totalSettlementAmount, 0),
    totalTaxAmount: zhongqinJulyWorkers.reduce((sum, item) => sum + item.totalTaxAmount, 0),
    totalNetAmount: zhongqinJulyWorkers.reduce((sum, item) => sum + item.totalNetAmount, 0),
    workers: zhongqinJulyWorkers,
    status: 'generated',
    generatedAt: '2026-07-06T09:00:00.000Z',
  },
  {
    id: 'taxd_002',
    declarationNo: 'TAX-202606-SP-ZQ-001',
    serviceProviderId: 'sp_zhongqin',
    serviceProviderName: '中秦灵活用工服务有限公司',
    month: '2026-06',
    workerCount: 1,
    totalSettlementAmount: 6850,
    totalTaxAmount: calcWithholdingTax(6850),
    totalNetAmount: calcNetAfterTax(6850),
    workers: [
      worker('emp_001', '张伟', '13800001001', '6101**********1234', [
        line('txw_006', 'WD202606280001', 'alipay', 6850, '2026-07-06T09:30:00.000Z'),
      ]),
    ],
    status: 'filed',
    generatedAt: '2026-07-01T08:00:00.000Z',
  },
]
