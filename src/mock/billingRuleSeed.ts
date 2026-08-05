import type { BillingRule } from '@/types'
import { billingFormulaExamples } from '@/constants/billingRule'

const hourlyExample = billingFormulaExamples.find((e) => e.key === 'hourly')!
const taskExample = billingFormulaExamples.find((e) => e.key === 'task')!
const mixedExample = billingFormulaExamples.find((e) => e.key === 'mixed')!

export const seedBillingRules: BillingRule[] = [
  {
    id: 'br_001',
    name: '标准工时计薪',
    code: 'PAYROLL_HOURLY',
    description: hourlyExample.description,
    scope: 'global',
    enterpriseScope: 'all',
    payrollFormula: hourlyExample.formula,
    serviceFeeFormula: 'payroll_total * service_fee_rate',
    enabled: true,
    isDefault: true,
    createdAt: '2024-06-01T08:00:00.000Z',
    updatedAt: '2024-10-01T08:00:00.000Z',
  },
  {
    id: 'br_002',
    name: '标准任务计薪',
    code: 'PAYROLL_TASK',
    description: taskExample.description,
    scope: 'global',
    enterpriseScope: 'specific',
    enterpriseIds: ['ent_china_mobile_agent', 'ent_pingan_partner'],
    payrollFormula: taskExample.formula,
    serviceFeeFormula: 'payroll_total * service_fee_rate',
    enabled: true,
    createdAt: '2024-07-15T08:00:00.000Z',
    updatedAt: '2024-09-20T08:00:00.000Z',
  },
  {
    id: 'br_003',
    name: '工时+任务混合计薪',
    code: 'PAYROLL_MIXED',
    description: mixedExample.description,
    scope: 'global',
    enterpriseScope: 'all',
    payrollFormula: mixedExample.formula,
    serviceFeeFormula: 'payroll_total * service_fee_rate',
    enabled: true,
    createdAt: '2024-08-01T08:00:00.000Z',
    updatedAt: '2024-08-01T08:00:00.000Z',
  },
]
