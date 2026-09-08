import type { WorkerJoinApplication } from '@/types'
import { findSeedPositionId } from '@/mock/positionSeed'

const posHall = findSeedPositionId('营业厅营业员', 'ent_china_mobile_agent')
const posPromo = findSeedPositionId('终端销售员', 'ent_china_mobile_agent')
const posStarsHall = findSeedPositionId('营业厅营业员')

export const seedWorkerJoinApplications: WorkerJoinApplication[] = [
  {
    id: 'dja_001',
    employeeId: 'emp_001',
    enterpriseId: 'ent_china_mobile_agent',
    departmentId: 'dept_prod_a',
    positionId: posHall,
    positionName: '营业厅营业员',
    status: 'approved',
    appliedAt: '2022-03-14T10:00:00.000Z',
    reviewedAt: '2022-03-15T09:20:00.000Z',
    assignedDepartmentId: 'dept_prod_a',
    assignedPosition: '营业厅营业员',
    source: 'qr',
  },
  {
    id: 'dja_002',
    employeeId: 'emp_001',
    enterpriseId: 'ent_china_mobile_agent',
    departmentId: 'dept_cm_field',
    positionId: posPromo,
    positionName: '终端销售员',
    status: 'approved',
    appliedAt: '2026-05-28T11:00:00.000Z',
    reviewedAt: '2026-06-01T09:10:00.000Z',
    assignedDepartmentId: 'dept_cm_field',
    assignedPosition: '推广专员',
    source: 'qr',
  },
  {
    id: 'dja_003',
    employeeId: 'emp_001',
    enterpriseId: 'ent_stars_telecom',
    departmentId: 'dept_prod_b',
    positionId: posStarsHall,
    positionName: '营业厅营业员',
    status: 'pending',
    appliedAt: '2026-08-20T14:30:00.000Z',
    source: 'qr',
  },
  {
    id: 'dja_004',
    employeeId: 'emp_001',
    enterpriseId: 'ent_china_telecom_agent',
    departmentId: 'dept_sh_hall',
    positionName: '营业厅营业员',
    status: 'rejected',
    appliedAt: '2026-07-08T16:20:00.000Z',
    reviewedAt: '2026-07-10T10:00:00.000Z',
    reviewNote: '该厅岗位名额已满，请改扫其他部门二维码',
    source: 'qr',
  },
  {
    id: 'dja_pending_002',
    employeeId: 'emp_pending_002',
    enterpriseId: 'ent_china_mobile_agent',
    departmentId: 'dept_cm_field',
    positionId: posPromo,
    positionName: '终端销售员',
    status: 'pending',
    appliedAt: '2026-07-29T09:00:00.000Z',
    source: 'qr',
  },
]
