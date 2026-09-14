import { formatWorkflowEnterpriseLabel, workflowStatusMap } from '@/constants/task'
import type {
  Enterprise,
  TaskWorkflow,
  TaskWorkflowVersion,
  TaskWorkflowVersionSnapshot,
} from '@/types'
import { generateId } from '@/utils'

export function createSnapshotFromWorkflow(
  workflow: TaskWorkflow | TaskWorkflowVersionSnapshot,
): TaskWorkflowVersionSnapshot {
  return JSON.parse(
    JSON.stringify({
      name: workflow.name,
      description: workflow.description,
      enterpriseScope: workflow.enterpriseScope,
      enterpriseIds: workflow.enterpriseIds,
      linkedTaskTypeId: workflow.linkedTaskTypeId,
      nodes: workflow.nodes,
      fields: workflow.fields,
      status: workflow.status,
    }),
  ) as TaskWorkflowVersionSnapshot
}

export function ensureWorkflowVersions(workflow: TaskWorkflow): TaskWorkflow {
  if (workflow.versions?.length) {
    const active = workflow.versions.find((v) => v.isActive)
    return {
      ...workflow,
      version: workflow.version || active?.version || workflow.versions[0]?.version || 1,
      versions: workflow.versions,
    }
  }
  const versionNo = workflow.version || 1
  const version: TaskWorkflowVersion = {
    id: generateId('wfv'),
    version: versionNo,
    isActive: true,
    publishedAt: workflow.updatedAt || workflow.createdAt,
    changeNote: '初始版本',
    snapshot: createSnapshotFromWorkflow(workflow),
  }
  return {
    ...workflow,
    version: versionNo,
    versions: [version],
  }
}

export function formatWorkflowVersionLabel(version: number): string {
  return version > 0 ? `V${version}` : '—'
}

export function formatWorkflowVersionTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function summarizeWorkflowVersionSnapshot(
  snapshot: TaskWorkflowVersionSnapshot,
  enterprises: Enterprise[] = [],
): string[] {
  return [
    `流程名称：${snapshot.name}`,
    `状态：${workflowStatusMap[snapshot.status]}`,
    `适用企业：${formatWorkflowEnterpriseLabel(snapshot, enterprises)}`,
    `节点数：${snapshot.nodes?.length ?? 0}`,
    `字段数：${snapshot.fields?.length ?? 0}`,
    snapshot.description ? `描述：${snapshot.description}` : '描述：—',
  ]
}

export function buildWorkflowVersionRecord(
  workflow: TaskWorkflow,
  version: number,
  changeNote?: string,
): TaskWorkflowVersion {
  return {
    id: generateId('wfv'),
    version,
    isActive: true,
    publishedAt: new Date().toISOString(),
    changeNote: changeNote || '配置发布',
    snapshot: createSnapshotFromWorkflow(workflow),
  }
}

export function nextWorkflowVersionNumber(workflow: TaskWorkflow): number {
  const fromHistory = (workflow.versions ?? []).reduce(
    (max, v) => Math.max(max, v.version),
    0,
  )
  return Math.max(workflow.version || 0, fromHistory) + 1
}

/** 将版本快照拼成可用于流程图预览的工作流对象 */
export function workflowFromVersionSnapshot(
  base: TaskWorkflow,
  version: TaskWorkflowVersion,
): TaskWorkflow {
  return {
    ...base,
    ...version.snapshot,
    id: base.id,
    version: version.version,
    versions: base.versions,
    boundTaskTypeCount: base.boundTaskTypeCount,
    createdAt: base.createdAt,
    updatedAt: version.publishedAt,
  }
}
