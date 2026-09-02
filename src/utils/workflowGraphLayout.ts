import type { WorkflowNode } from '@/types'
import type { WorkflowFlowEdge } from '@/utils/workflow'
import { CANVAS_CARD_H, CANVAS_CARD_W, sortedWorkflowNodes } from '@/utils/workflow'

export interface WorkflowGraphNodeLayout {
  id: string
  x: number
  y: number
  col: number
  row: number
}

export interface WorkflowGraphEdgeLayout {
  edge: WorkflowFlowEdge
  path: string
  labelX: number
  labelY: number
  isMain: boolean
  isBackward: boolean
}

const NODE_W = 112
const NODE_H = 96
const COL_STEP = 168
const ROW_STEP = 132
const PAD_X = 56
const PAD_Y = 48

export function getMainPathOrdered(
  nodes: WorkflowNode[],
  edges: WorkflowFlowEdge[],
): string[] {
  const sorted = sortedWorkflowNodes(nodes)
  const nodeMap = new Map(sorted.map((n) => [n.id, n]))
  const start = sorted.find((n) => n.nodeType === 'start')
  if (!start) return sorted.map((n) => n.id)

  const ordered: string[] = []
  let current: WorkflowNode | undefined = start
  const visited = new Set<string>()
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    ordered.push(current.id)
    if (current.nodeType === 'end') break
    const nextEdge = edges.find((e) => e.from === current!.id && !e.isBranch)
    if (!nextEdge) break
    current = nodeMap.get(nextEdge.to)
  }
  return ordered
}

export function computeWorkflowGraphLayout(
  nodes: WorkflowNode[],
  edges: WorkflowFlowEdge[],
): {
  nodeLayouts: Map<string, WorkflowGraphNodeLayout>
  edgeLayouts: WorkflowGraphEdgeLayout[]
  width: number
  height: number
} {
  const sorted = sortedWorkflowNodes(nodes)
  const mainPath = getMainPathOrdered(nodes, edges)

  const colRow = new Map<string, { col: number; row: number }>()
  mainPath.forEach((id, i) => colRow.set(id, { col: i, row: 0 }))

  let branchSlot = 1
  const unplaced = sorted.filter((n) => !colRow.has(n.id))
  for (const node of unplaced) {
    const incoming = edges.filter((e) => e.to === node.id)
    let col = 0
    let row = branchSlot % 2 === 1 ? branchSlot : -branchSlot
    branchSlot++

    if (incoming.length) {
      const sourceCols = incoming
        .map((e) => colRow.get(e.from))
        .filter(Boolean) as { col: number; row: number }[]
      if (sourceCols.length) {
        col = Math.max(...sourceCols.map((s) => s.col)) + 1
        const avgRow = sourceCols.reduce((s, v) => s + v.row, 0) / sourceCols.length
        row = avgRow >= 0 ? Math.ceil(avgRow) + 1 : Math.floor(avgRow) - 1
        if (row === 0) row = branchSlot % 2 === 0 ? 1 : -1
      }
    } else {
      col = mainPath.length
      row = 1
    }

    while ([...colRow.values()].some((v) => v.col === col && v.row === row)) {
      row += row > 0 ? 1 : -1
    }
    colRow.set(node.id, { col, row })
  }

  const nodeLayouts = new Map<string, WorkflowGraphNodeLayout>()
  let minRow = 0
  let maxRow = 0
  let maxCol = 0
  for (const [id, { col, row }] of colRow) {
    minRow = Math.min(minRow, row)
    maxRow = Math.max(maxRow, row)
    maxCol = Math.max(maxCol, col)
    nodeLayouts.set(id, {
      id,
      col,
      row,
      x: PAD_X + col * COL_STEP + NODE_W / 2,
      y: PAD_Y + (row - minRow) * ROW_STEP + NODE_H / 2,
    })
  }

  const height = PAD_Y * 2 + (maxRow - minRow + 1) * ROW_STEP
  const width = PAD_X * 2 + (maxCol + 1) * COL_STEP + NODE_W / 2

  const edgeLayouts: WorkflowGraphEdgeLayout[] = edges.map((edge) => {
    const from = nodeLayouts.get(edge.from)
    const to = nodeLayouts.get(edge.to)
    if (!from || !to) {
      return {
        edge,
        path: '',
        labelX: 0,
        labelY: 0,
        isMain: !edge.isBranch,
        isBackward: false,
      }
    }

    const isMain = !edge.isBranch
    const isBackward = to.col < from.col || (to.col === from.col && to.y > from.y + 20)

    const fx = from.x + NODE_W * 0.38
    const fy = from.y
    const tx = to.x - NODE_W * 0.38
    const ty = to.y

    let path: string
    if (Math.abs(from.row - to.row) < 0.01 && tx > fx) {
      path = `M ${fx} ${fy} L ${tx} ${ty}`
    } else if (isBackward) {
      const midY = Math.max(from.y, to.y) + ROW_STEP * 0.55
      path = `M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`
    } else {
      const midX = (fx + tx) / 2
      path = `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${ty}, ${tx} ${ty}`
    }

    const labelX = (fx + tx) / 2
    const labelY = (fy + ty) / 2 - (Math.abs(fy - ty) > 10 ? 8 : 14)

    return { edge, path, labelX, labelY, isMain, isBackward }
  })

  return { nodeLayouts, edgeLayouts, width, height }
}

export { NODE_W, NODE_H }

/** 基于画布坐标的连线（BPM 式自由布局） */
export function computeWorkflowEdgeLayouts(
  nodes: WorkflowNode[],
  edges: WorkflowFlowEdge[],
): WorkflowGraphEdgeLayout[] {
  const pos = new Map(
    nodes.filter((n) => n.position).map((n) => [n.id, n.position!] as const),
  )

  return edges.map((edge) => {
    const fromPos = pos.get(edge.from)
    const toPos = pos.get(edge.to)
    if (!fromPos || !toPos) {
      return {
        edge,
        path: '',
        labelX: 0,
        labelY: 0,
        isMain: !edge.isBranch,
        isBackward: false,
      }
    }

    const fx = fromPos.x + CANVAS_CARD_W
    const fy = fromPos.y + CANVAS_CARD_H / 2
    const tx = toPos.x
    const ty = toPos.y + CANVAS_CARD_H / 2
    const isMain = !edge.isBranch
    const isBackward = tx < fx - 24

    let path: string
    if (Math.abs(fy - ty) < 8 && tx > fx) {
      path = `M ${fx} ${fy} L ${tx} ${ty}`
    } else if (isBackward) {
      const midY = Math.max(fy, ty) + 80
      path = `M ${fx} ${fy} C ${fx + 40} ${midY}, ${tx - 40} ${midY}, ${tx} ${ty}`
    } else {
      const midX = (fx + tx) / 2
      path = `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${ty}, ${tx} ${ty}`
    }

    return {
      edge,
      path,
      labelX: (fx + tx) / 2,
      labelY: (fy + ty) / 2 - 12,
      isMain,
      isBackward,
    }
  })
}
