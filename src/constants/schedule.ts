export const confirmStatusMap = {
  pending: { label: '待确认', short: '待', color: '#909399', bg: '#f4f4f5' },
  confirming: { label: '确认中', short: '中', color: '#e6a23c', bg: '#fdf6ec' },
  confirmed: { label: '已确认', short: '✓', color: '#67c23a', bg: '#f0f9eb' },
  rejected: { label: '已拒绝', short: '✗', color: '#f56c6c', bg: '#fef0f0' },
} as const

export function cellKey(employeeId: string, date: string) {
  return `${employeeId}#${date}`
}

export function parseCellKey(key: string) {
  const idx = key.indexOf('#')
  return { employeeId: key.slice(0, idx), date: key.slice(idx + 1) }
}

export function shiftShortName(name: string) {
  if (name.includes('休')) return '休'
  return name.slice(0, 1)
}
