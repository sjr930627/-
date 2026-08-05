import type { BillImportTemplate } from '@/types'
import { createDefaultImportFields } from '@/constants/billImportTemplate'

const createId = (() => {
  let n = 0
  return () => `pf_seed_${++n}`
})()

export const seedBillImportTemplates: BillImportTemplate[] = [
  {
    id: 'bit_default',
    name: '标准工时+任务导入模板',
    enterpriseScope: 'all',
    fields: createDefaultImportFields(createId),
    createdAt: '2024-06-01T08:00:00.000Z',
    updatedAt: '2024-10-01T08:00:00.000Z',
  },
  {
    id: 'bit_direct_amount',
    name: '直接结算金额模板',
    enterpriseScope: 'all',
    fields: [
      { id: 'pf_d1', key: 'employee_name', label: '姓名', columnHeader: '姓名', dataType: 'text', required: true },
      { id: 'pf_d2', key: 'employee_no', label: '工号', columnHeader: '工号', dataType: 'text', required: false },
      { id: 'pf_d3', key: 'department', label: '部门', columnHeader: '部门', dataType: 'text', required: true },
      { id: 'pf_d4', key: 'settlement_amount', label: '结算金额', columnHeader: '结算金额', dataType: 'number', required: true, min: 0 },
      { id: 'pf_d5', key: 'service_fee', label: '服务费', columnHeader: '服务费', dataType: 'number', required: false, min: 0 },
    ],
    createdAt: '2024-08-01T08:00:00.000Z',
    updatedAt: '2024-08-01T08:00:00.000Z',
  },
]
