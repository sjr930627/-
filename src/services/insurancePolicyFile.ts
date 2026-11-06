export interface InsurancePolicyFileInput {
  policyNo: string
  employeeName: string
  phone: string
  enterpriseName: string
  departmentName: string
  productName: string
  planId: string
  provider: string
  productType: string
  coverageText: string
  enrolledAtText: string
  periodText: string
  statusText: string
  description: string
}

/** 按当前保单信息生成可预览的保单 PDF */
export function buildInsurancePolicyPdfBlob(input: InsurancePolicyFileInput): Blob {
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

  ctx.fillStyle = '#0f766e'
  ctx.fillRect(0, 0, pageW, 8)
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 22px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('保险保单', 48, 56)
  ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#6b7280'
  ctx.fillText(input.policyNo || '保单文件', 48, 80)

  ctx.strokeStyle = '#e5e7eb'
  ctx.beginPath()
  ctx.moveTo(48, 98)
  ctx.lineTo(pageW - 48, 98)
  ctx.stroke()

  const rows: Array<[string, string]> = [
    ['保单号', input.policyNo || '—'],
    ['被保险人', input.employeeName || '—'],
    ['手机号', input.phone || '—'],
    ['企业', input.enterpriseName || '—'],
    ['部门', input.departmentName || '—'],
    ['产品名称', input.productName || '—'],
    ['产品方案 ID', input.planId || '—'],
    ['险种', input.productType || '—'],
    ['承保公司', input.provider || '—'],
    ['保障范围', input.coverageText || '—'],
    ['投保时间', input.enrolledAtText || '—'],
    ['投保期限', input.periodText || '—'],
    ['投保状态', input.statusText || '—'],
  ]

  let y = 132
  for (const [label, value] of rows) {
    ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillStyle = '#6b7280'
    ctx.fillText(label, 48, y)
    ctx.fillStyle = '#111827'
    ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif'
    const lines = wrapText(ctx, value || '—', pageW - 196)
    lines.forEach((line, index) => {
      ctx.fillText(line, 150, y + index * 18)
    })
    y += Math.max(26, lines.length * 18 + 8)
  }

  y += 8
  ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#111827'
  ctx.fillText('产品介绍', 48, y)
  y += 22
  ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif'
  for (const line of wrapText(ctx, input.description || '—', pageW - 96)) {
    if (y > pageH - 48) break
    ctx.fillText(line, 48, y)
    y += 20
  }

  const jpeg = canvas.toDataURL('image/jpeg', 0.92)
  const raw = atob(jpeg.split(',')[1] || '')
  const imgBytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) imgBytes[i] = raw.charCodeAt(i)
  return embedJpegInPdf(imgBytes, pageW, pageH, canvas.width, canvas.height)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ''
  for (const ch of text) {
    const next = current + ch
    if (ctx.measureText(next).width > maxWidth) {
      if (current) lines.push(current)
      current = ch
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['—']
}

function embedJpegInPdf(jpeg: Uint8Array, pageW: number, pageH: number, imgW: number, imgH: number): Blob {
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
  push(`4 0 obj\n<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}\nendstream\nendobj\n`)

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
