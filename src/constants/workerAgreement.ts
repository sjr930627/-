import type { WorkerAgreement, WorkerAgreementType } from '@/types'

export const workerAgreementTypeMap: Record<WorkerAgreementType, string> = {
  service: '灵工服务协议',
  dispatch: '承揽/派遣协议',
  privacy: '个人信息授权',
  safety: '安全承诺书',
  other: '其他协议',
}

/** 合同管理仅展示：待签署 / 已签署 */
export type WorkerAgreementDisplayStatus = 'pending' | 'signed'

export const workerAgreementStatusMap: Record<
  WorkerAgreementDisplayStatus,
  { label: string; tag: 'success' | 'warning' | 'info' | 'danger' }
> = {
  pending: { label: '待签署', tag: 'warning' },
  signed: { label: '已签署', tag: 'success' },
}

export function resolveWorkerAgreementStatus(
  agr: Pick<WorkerAgreement, 'signed' | 'status'>,
): WorkerAgreementDisplayStatus {
  if (agr.signed || agr.status === 'signed' || agr.status === 'expired' || agr.status === 'terminated') {
    return 'signed'
  }
  return 'pending'
}

export interface WorkerAgreementPdfMeta {
  employeeName: string
  phone: string
  providerName: string
}

/** 将协议内容绘制为 A4 页并嵌入 PDF，便于中文展示 */
export function buildWorkerAgreementPdfBlob(
  agr: WorkerAgreement,
  meta: WorkerAgreementPdfMeta,
): Blob {
  const pageW = 595
  const pageH = 842
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = pageW * scale
  canvas.height = pageH * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return new Blob(['%PDF-1.1\n%%EOF'], { type: 'application/pdf' })
  }

  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, pageW, pageH)

  ctx.fillStyle = '#111827'
  ctx.font = 'bold 22px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(agr.title || '灵工服务协议', 48, 64)

  ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#6b7280'
  ctx.fillText('已签署合同（PDF）', 48, 88)

  ctx.strokeStyle = '#e5e7eb'
  ctx.beginPath()
  ctx.moveTo(48, 104)
  ctx.lineTo(pageW - 48, 104)
  ctx.stroke()

  const rows: Array<[string, string]> = [
    ['协议编号', agr.contractNo || '—'],
    ['灵工人员', meta.employeeName || '—'],
    ['手机号', meta.phone || '—'],
    ['服务商', meta.providerName || '—'],
    ['生效日期', agr.effectiveDate || '—'],
    ['签署时间', agr.signedAt ? new Date(agr.signedAt).toLocaleString('zh-CN') : '—'],
  ]

  ctx.fillStyle = '#111827'
  let y = 140
  for (const [label, value] of rows) {
    ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillStyle = '#6b7280'
    ctx.fillText(label, 48, y)
    ctx.fillStyle = '#111827'
    ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(value, 140, y)
    y += 28
  }

  y += 12
  ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('协议内容', 48, y)
  y += 24

  ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif'
  const content = agr.content || '（无协议正文）'
  const lines = wrapText(ctx, content, pageW - 96)
  for (const line of lines) {
    if (y > pageH - 80) break
    ctx.fillText(line, 48, y)
    y += 22
  }

  y = Math.max(y + 36, pageH - 120)
  ctx.strokeStyle = '#d1d5db'
  ctx.strokeRect(48, y, 200, 64)
  ctx.fillStyle = '#6b7280'
  ctx.font = '11px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('签署人签章', 58, y + 22)
  ctx.fillStyle = '#111827'
  ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(meta.employeeName || '已签署', 58, y + 46)

  const jpeg = canvas.toDataURL('image/jpeg', 0.92)
  const img = atob(jpeg.split(',')[1] || '')
  const imgBytes = new Uint8Array(img.length)
  for (let i = 0; i < img.length; i += 1) imgBytes[i] = img.charCodeAt(i)

  return embedJpegInPdf(imgBytes, pageW, pageH, canvas.width, canvas.height)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(current)
      current = ''
      continue
    }
    const next = current + ch
    if (ctx.measureText(next).width > maxWidth) {
      if (current) lines.push(current)
      current = ch
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function embedJpegInPdf(
  jpeg: Uint8Array,
  pageW: number,
  pageH: number,
  imgW: number,
  imgH: number,
): Blob {
  const encoder = new TextEncoder()
  const objects: Uint8Array[] = []

  const push = (content: string | Uint8Array) => {
    objects.push(typeof content === 'string' ? encoder.encode(content) : content)
  }

  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n`,
  )
  const contentStream = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`
  push(
    `4 0 obj\n<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
  )

  const imgHeader = encoder.encode(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  )
  const imgFooter = encoder.encode('\nendstream\nendobj\n')
  const imgObj = new Uint8Array(imgHeader.length + jpeg.length + imgFooter.length)
  imgObj.set(imgHeader, 0)
  imgObj.set(jpeg, imgHeader.length)
  imgObj.set(imgFooter, imgHeader.length + jpeg.length)
  push(imgObj)

  let body = encoder.encode('%PDF-1.4\n')
  const offsets = [0]
  for (const obj of objects) {
    offsets.push(body.length)
    const next = new Uint8Array(body.length + obj.length)
    next.set(body, 0)
    next.set(obj, body.length)
    body = next
  }

  const xrefStart = body.length
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  const xrefBytes = encoder.encode(xref)
  const pdf = new Uint8Array(body.length + xrefBytes.length)
  pdf.set(body, 0)
  pdf.set(xrefBytes, body.length)
  return new Blob([pdf], { type: 'application/pdf' })
}
