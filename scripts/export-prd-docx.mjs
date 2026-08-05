#!/usr/bin/env node
/**
 * 将 docs/灵工平台PRD.md 导出为 Word (.docx)
 * 用法: node scripts/export-prd-docx.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from 'docx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const mdPath = path.join(root, 'docs/灵工平台PRD.md')
const outPath = path.join(root, 'docs/灵工平台PRD.docx')

function parseInline(text) {
  const runs = []
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  for (const part of parts) {
    if (!part) continue
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }))
    } else {
      runs.push(new TextRun({ text: part }))
    }
  }
  return runs.length ? runs : [new TextRun({ text: '' })]
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

function isSeparatorRow(cells) {
  return cells.every((c) => /^[-:]+$/.test(c))
}

function buildTable(headerCells, bodyRows) {
  const colCount = headerCells.length
  const widthPct = Math.floor(9000 / colCount)
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  }

  const mkCell = (text, bold = false) =>
    new TableCell({
      borders,
      width: { size: widthPct, type: WidthType.DXA },
      children: [
        new Paragraph({
          children: bold ? [new TextRun({ text, bold: true })] : parseInline(text),
        }),
      ],
    })

  const rows = [
    new TableRow({
      children: headerCells.map((c) => mkCell(c, true)),
    }),
    ...bodyRows.map(
      (cells) =>
        new TableRow({
          children: cells.map((c) => mkCell(c)),
        }),
    ),
  ]

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  })
}

function mdToDocxChildren(md) {
  const lines = md.split('\n')
  const children = []
  let i = 0
  let tableHeader = null
  let tableBody = []

  const flushTable = () => {
    if (tableHeader && tableBody.length) {
      children.push(buildTable(tableHeader, tableBody))
      children.push(new Paragraph({ text: '' }))
    }
    tableHeader = null
    tableBody = []
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('|')) {
      const cells = parseTableRow(trimmed)
      if (isSeparatorRow(cells)) {
        i++
        continue
      }
      if (!tableHeader) {
        tableHeader = cells
      } else {
        tableBody.push(cells)
      }
      i++
      continue
    } else {
      flushTable()
    }

    if (trimmed === '---') {
      i++
      continue
    }

    if (trimmed.startsWith('# ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: parseInline(trimmed.slice(2)),
          spacing: { after: 200 },
        }),
      )
    } else if (trimmed.startsWith('## ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: parseInline(trimmed.slice(3)),
          spacing: { before: 240, after: 120 },
        }),
      )
    } else if (trimmed.startsWith('### ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: parseInline(trimmed.slice(4)),
          spacing: { before: 180, after: 100 },
        }),
      )
    } else if (trimmed.startsWith('#### ')) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: parseInline(trimmed.slice(5)),
          spacing: { before: 120, after: 80 },
        }),
      )
    } else if (trimmed.startsWith('- ')) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseInline(trimmed.slice(2)),
          spacing: { after: 60 },
        }),
      )
    } else if (/^\d+\.\s/.test(trimmed)) {
      children.push(
        new Paragraph({
          children: parseInline(trimmed.replace(/^\d+\.\s/, '')),
          spacing: { after: 60 },
          indent: { left: 360 },
        }),
      )
    } else if (trimmed.startsWith('*') && trimmed.endsWith('*')) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: trimmed.replace(/\*/g, ''), italics: true })],
          spacing: { before: 120, after: 120 },
        }),
      )
    } else if (trimmed) {
      children.push(
        new Paragraph({
          children: parseInline(trimmed),
          spacing: { after: 80 },
        }),
      )
    }

    i++
  }

  flushTable()
  return children
}

async function main() {
  if (!fs.existsSync(mdPath)) {
    console.error('找不到:', mdPath)
    process.exit(1)
  }

  const md = fs.readFileSync(mdPath, 'utf-8')
  const children = mdToDocxChildren(md)

  const doc = new Document({
    creator: '灵工平台',
    title: '灵工平台产品需求文档（PRD）',
    description: '三端功能模块字段限制与操作说明',
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, buffer)
  console.log('已导出:', outPath)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
