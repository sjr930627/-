<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, UserFilled } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import type { GrabShiftSlot } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const selectedGroupId = ref('ag_factory')
const activeTab = ref<'slots' | 'approval'>('slots')
const slotStatusFilter = ref<'all' | 'open' | 'partial' | 'full' | 'cancelled'>('all')
const publishVisible = ref(false)
const detailVisible = ref(false)
const whitelistVisible = ref(false)
const currentSlot = ref<GrabShiftSlot | null>(null)
const whitelistForm = ref({ employeeId: '', remark: '' })

const groupList = computed(() =>
  store.attendanceGroups.filter((g) => g.attendanceType === 'shift'),
)

const availableTeams = computed(() => store.getTeamsForGroup(selectedGroupId.value))

const publishForm = ref({
  teamId: '',
  shiftId: 'shift_morning',
  date: '2026-07-28',
  requiredCount: 1,
  requirements: [] as string[],
})

const skillOptions = ['普通话二级', '客服证', '夜班资质', '叉车证', '电工证']

const grabStatusMap: Record<string, { label: string; type: 'success' | 'warning' | 'danger' | 'info' }> = {
  open: { label: '招募中', type: 'danger' },
  partial: { label: '部分满员', type: 'warning' },
  full: { label: '已满员', type: 'success' },
  cancelled: { label: '已取消', type: 'info' },
}

const slotTableData = computed(() =>
  store.grabShiftSlots
    .filter((s) => s.attendanceGroupId === selectedGroupId.value)
    .filter((s) => slotStatusFilter.value === 'all' || s.status === slotStatusFilter.value)
    .map((slot) => {
      const pendingApps = store.grabShiftApplications.filter(
        (a) => a.slotId === slot.id && a.status === 'pending',
      ).length
      return {
        ...slot,
        pendingApps,
        gap: Math.max(0, slot.requiredCount - slot.grabbedCount),
        statusLabel: grabStatusMap[slot.status]?.label ?? slot.status,
        statusType: grabStatusMap[slot.status]?.type ?? 'info',
      }
    }),
)

const pendingApplications = computed(() =>
  store.grabShiftApplications
    .filter((a) => a.status === 'pending')
    .filter((a) => {
      const slot = store.grabShiftSlots.find((s) => s.id === a.slotId)
      return slot?.attendanceGroupId === selectedGroupId.value
    })
    .map((app) => {
      const slot = store.grabShiftSlots.find((s) => s.id === app.slotId)
      const emp = store.employees.find((e) => e.id === app.employeeId)
      return {
        ...app,
        employeeName: emp?.name ?? '—',
        employeeNo: emp?.employeeNo ?? '—',
        shiftName: slot?.shiftName ?? '—',
        date: slot?.date ?? '—',
        teamName: slot?.teamName ?? '—',
        slotStatus: slot?.status ?? 'cancelled',
      }
    }),
)

const pendingCount = computed(() => pendingApplications.value.length)

const whitelistTableData = computed(() =>
  store.grabShiftWhitelist
    .filter((w) => w.attendanceGroupId === selectedGroupId.value)
    .map((entry) => {
      const emp = store.employees.find((e) => e.id === entry.employeeId)
      return {
        ...entry,
        employeeName: emp?.name ?? '—',
        employeeNo: emp?.employeeNo ?? '—',
        position: emp?.position ?? '—',
      }
    }),
)

const whitelistCandidateOptions = computed(() =>
  store.employees
    .filter((e) => e.status === 'active')
    .filter(
      (e) =>
        !store.grabShiftWhitelist.some(
          (w) => w.employeeId === e.id && w.attendanceGroupId === selectedGroupId.value,
        ),
    )
    .map((e) => ({
      value: e.id,
      label: `${e.name}（${e.employeeNo}）`,
    })),
)

const slotApplications = computed(() => {
  if (!currentSlot.value) return []
  return store.grabShiftApplications
    .filter((a) => a.slotId === currentSlot.value!.id)
    .map((app) => ({
      ...app,
      employeeName: store.employees.find((e) => e.id === app.employeeId)?.name ?? '—',
      statusLabel:
        app.status === 'pending'
          ? '待审批'
          : app.status === 'approved'
            ? app.reviewNote === '白名单免审批'
              ? '已通过（白名单）'
              : '已通过'
            : '已驳回',
    }))
})

function openPublish() {
  publishForm.value = {
    teamId: availableTeams.value[0]?.id ?? '',
    shiftId: 'shift_morning',
    date: '2026-07-28',
    requiredCount: 1,
    requirements: [],
  }
  publishVisible.value = true
}

function submitPublish() {
  const team = availableTeams.value.find((t) => t.id === publishForm.value.teamId)
  const shift = store.shifts.find((s) => s.id === publishForm.value.shiftId)
  if (!team || !shift) {
    ElMessage.warning('请选择班组和班次')
    return
  }
  store.createGrabShiftSlot({
    attendanceGroupId: selectedGroupId.value,
    teamId: team.id,
    teamName: team.name,
    shiftId: shift.id,
    shiftName: shift.name,
    date: publishForm.value.date,
    startTime: shift.startTime,
    endTime: shift.endTime,
    requiredCount: publishForm.value.requiredCount,
    requirements: publishForm.value.requirements,
  })
  publishVisible.value = false
  ElMessage.success('抢班班次已发布，灵工可在自助端报名')
}

function openWhitelist() {
  whitelistForm.value = { employeeId: whitelistCandidateOptions.value[0]?.value ?? '', remark: '' }
  whitelistVisible.value = true
}

function submitWhitelist() {
  if (!whitelistForm.value.employeeId) {
    ElMessage.warning('请选择人员')
    return
  }
  try {
    store.addGrabShiftWhitelistEntry({
      attendanceGroupId: selectedGroupId.value,
      employeeId: whitelistForm.value.employeeId,
      remark: whitelistForm.value.remark.trim() || undefined,
      createdBy: '排班员',
    })
    whitelistForm.value = { employeeId: '', remark: '' }
    ElMessage.success('已加入白名单，该人员抢班报名将免审批')
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '添加失败')
  }
}

async function removeWhitelist(id: string, name: string) {
  await ElMessageBox.confirm(`确定将「${name}」移出白名单？移出后抢班需人工审批。`, '移出白名单', {
    type: 'warning',
  })
  store.removeGrabShiftWhitelistEntry(id)
  ElMessage.success('已移出白名单')
}

async function cancelSlot(id: string) {
  await ElMessageBox.confirm('取消后该班次将不再接受报名，是否继续？', '取消抢班班次', {
    type: 'warning',
  })
  store.cancelGrabShiftSlot(id)
  ElMessage.success('已取消')
}

function showSlotDetail(slot: GrabShiftSlot) {
  currentSlot.value = slot
  detailVisible.value = true
}

async function reviewApplication(id: string, approved: boolean) {
  try {
    const { value } = await ElMessageBox.prompt(
      approved ? '审批意见（可选）' : '驳回原因（必填）',
      approved ? '通过报名' : '驳回报名',
      {
        inputValue: approved ? '符合要求，予以通过' : '',
        inputPlaceholder: '请输入',
        inputValidator: (v) => {
          if (!approved && !v?.trim()) return '请填写驳回原因'
          return true
        },
      },
    )
    store.reviewGrabShiftApplication(id, approved, value)
    ElMessage.success(approved ? '已通过，排班表已更新' : '已驳回')
  } catch (e) {
    if (e instanceof Error && e.message) ElMessage.error(e.message)
  }
}

function goScheduleManage() {
  router.push({ path: '/schedule-manage', query: { group: selectedGroupId.value } })
}

watch(
  () => route.query.group,
  (group) => {
    if (typeof group === 'string' && store.attendanceGroups.some((g) => g.id === group)) {
      selectedGroupId.value = group
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="grab-shift-page">
    <header class="page-card page-header">
      <div>
        <h2 class="page-title">抢班管理</h2>
        <p class="text-muted">发布抢班班次，管理灵工报名与审批 · 白名单免审批 · 待审批 {{ pendingCount }} 条</p>
      </div>
      <div class="header-actions">
        <el-select v-model="selectedGroupId" style="width: 180px">
          <el-option v-for="g in groupList" :key="g.id" :label="g.name" :value="g.id" />
        </el-select>
        <el-button @click="goScheduleManage">返回排班管理</el-button>
        <el-button :icon="UserFilled" @click="openWhitelist">白名单管理</el-button>
        <el-button type="primary" :icon="Plus" @click="openPublish">发布抢班</el-button>
      </div>
    </header>

    <div class="page-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="抢班班次" name="slots">
          <div class="filter-bar">
            <el-radio-group v-model="slotStatusFilter" size="small">
              <el-radio-button value="all">全部</el-radio-button>
              <el-radio-button value="open">招募中</el-radio-button>
              <el-radio-button value="partial">部分满员</el-radio-button>
              <el-radio-button value="full">已满员</el-radio-button>
              <el-radio-button value="cancelled">已取消</el-radio-button>
            </el-radio-group>
          </div>

          <el-table :data="slotTableData" border stripe>
            <el-table-column prop="shiftName" label="班次" width="90" />
            <el-table-column label="日期时段" min-width="160">
              <template #default="{ row }">
                {{ row.date }} · {{ row.startTime }}-{{ row.endTime }}
              </template>
            </el-table-column>
            <el-table-column prop="teamName" label="班组" width="120" />
            <el-table-column label="需求/已抢" width="100">
              <template #default="{ row }">
                {{ row.grabbedCount }}/{{ row.requiredCount }}
                <span v-if="row.gap > 0" class="gap-text">（缺{{ row.gap }}）</span>
              </template>
            </el-table-column>
            <el-table-column label="技能要求" min-width="140">
              <template #default="{ row }">
                <el-tag v-for="r in row.requirements" :key="r" size="small" effect="plain" style="margin-right: 4px">
                  {{ r }}
                </el-tag>
                <span v-if="!row.requirements.length" class="text-muted">无</span>
              </template>
            </el-table-column>
            <el-table-column label="待审报名" width="90">
              <template #default="{ row }">
                <el-badge v-if="row.pendingApps" :value="row.pendingApps" type="warning">
                  <span>{{ row.pendingApps }} 条</span>
                </el-badge>
                <span v-else class="text-muted">0</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.statusType" size="small">{{ row.statusLabel }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="showSlotDetail(row)">详情</el-button>
                <el-button
                  v-if="row.status !== 'cancelled' && row.status !== 'full'"
                  link
                  type="danger"
                  @click="cancelSlot(row.id)"
                >
                  取消
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="`报名审批 (${pendingCount})`" name="approval">
          <el-alert
            type="info"
            :closable="false"
            title="灵工在自助端提交报名后进入待审批；白名单人员报名自动通过并写入排班表"
            style="margin-bottom: 16px"
          />

          <el-table :data="pendingApplications" border stripe>
            <el-table-column prop="employeeName" label="报名人" width="100" />
            <el-table-column prop="employeeNo" label="工号" width="100" />
            <el-table-column prop="shiftName" label="班次" width="90" />
            <el-table-column prop="date" label="日期" width="110" />
            <el-table-column prop="teamName" label="班组" width="120" />
            <el-table-column prop="message" label="报名说明" min-width="160" show-overflow-tooltip />
            <el-table-column label="提交时间" width="160">
              <template #default="{ row }">
                {{ new Date(row.createdAt).toLocaleString('zh-CN') }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button
                  link
                  type="success"
                  :disabled="row.slotStatus === 'full' || row.slotStatus === 'cancelled'"
                  @click="reviewApplication(row.id, true)"
                >
                  通过
                </el-button>
                <el-button link type="danger" @click="reviewApplication(row.id, false)">驳回</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!pendingApplications.length" description="暂无待审批报名" />
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog v-model="publishVisible" title="发布抢班" width="500px">
      <el-alert type="info" :closable="false" title="发布后灵工可在自助端查看并报名；白名单人员免审批" style="margin-bottom: 16px" />
      <el-form label-width="90px">
        <el-form-item label="班组" required>
          <el-select v-model="publishForm.teamId" style="width: 100%">
            <el-option v-for="t in availableTeams" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="班次" required>
          <el-select v-model="publishForm.shiftId" style="width: 100%">
            <el-option
              v-for="s in store.shifts.filter((x) => x.code !== 'REST')"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker v-model="publishForm.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="需求人数" required>
          <el-input-number v-model="publishForm.requiredCount" :min="1" :max="50" />
        </el-form-item>
        <el-form-item label="技能要求">
          <el-select v-model="publishForm.requirements" multiple style="width: 100%">
            <el-option v-for="s in skillOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="publishVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPublish">发布</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="whitelistVisible" title="白名单管理" width="680px">
      <el-alert
        type="info"
        :closable="false"
        title="白名单人员报名抢班时自动通过，无需人工审批，并直接写入排班表"
        style="margin-bottom: 16px"
      />

      <div class="whitelist-add-bar">
        <el-select
          v-model="whitelistForm.employeeId"
          filterable
          placeholder="选择人员"
          style="width: 220px"
        >
          <el-option
            v-for="opt in whitelistCandidateOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-input
          v-model="whitelistForm.remark"
          placeholder="备注（可选）"
          style="width: 200px"
          maxlength="50"
          show-word-limit
        />
        <el-button type="primary" :disabled="!whitelistCandidateOptions.length" @click="submitWhitelist">
          添加
        </el-button>
      </div>

      <el-table :data="whitelistTableData" border stripe style="margin-top: 16px">
        <el-table-column prop="employeeName" label="姓名" width="100" />
        <el-table-column prop="employeeNo" label="工号" width="100" />
        <el-table-column prop="position" label="岗位" min-width="120" />
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.remark || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="加入时间" width="160">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleString('zh-CN') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" @click="removeWhitelist(row.id, row.employeeName)">
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!whitelistTableData.length" description="当前考勤组暂无白名单人员" />
    </el-dialog>

    <el-drawer v-model="detailVisible" title="班次详情与报名记录" size="480px">
      <template v-if="currentSlot">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="班次">{{ currentSlot.shiftName }}</el-descriptions-item>
          <el-descriptions-item label="日期">{{ currentSlot.date }}</el-descriptions-item>
          <el-descriptions-item label="时段">
            {{ currentSlot.startTime }}-{{ currentSlot.endTime }}
          </el-descriptions-item>
          <el-descriptions-item label="班组">{{ currentSlot.teamName }}</el-descriptions-item>
          <el-descriptions-item label="进度">
            {{ currentSlot.grabbedCount }}/{{ currentSlot.requiredCount }} 人
          </el-descriptions-item>
        </el-descriptions>

        <h4 class="drawer-subtitle">报名记录</h4>
        <el-table :data="slotApplications" size="small" border>
          <el-table-column prop="employeeName" label="报名人" />
          <el-table-column prop="statusLabel" label="状态" width="80" />
          <el-table-column prop="message" label="说明" show-overflow-tooltip />
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.grab-shift-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px;
}

.page-header .page-title {
  margin: 0 0 6px;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-bar {
  margin-bottom: 16px;
}

.gap-text {
  color: #e6a23c;
  font-size: 12px;
}

.drawer-subtitle {
  margin: 20px 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.whitelist-add-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
</style>
