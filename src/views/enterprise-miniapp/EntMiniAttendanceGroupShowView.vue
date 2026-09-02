<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  attendanceGroupStatusMap,
  attendanceGroupTypeMap,
  formatMinMonthlyHours,
  formatVersionLabel,
  formatVersionTime,
  summarizeVersionSnapshot,
} from '@/constants/attendanceGroup'
import {
  formatDayShiftPeriod,
  formatNightShiftPeriod,
  formatVariablePrice,
  freePunchCountModeOptions,
  getGroupPricingConfig,
  getPeriodDurationHours,
} from '@/constants/attendanceGroupPricing'
import type { AttendanceGroup, AttendanceGroupVersion } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const groupId = computed(() => String(route.params.id ?? ''))

const group = computed(() => store.attendanceGroups.find((g) => g.id === groupId.value))

const versionHistory = computed(() => {
  if (!group.value?.versions?.length) return []
  return [...group.value.versions].sort((a, b) => b.version - a.version)
})

const pricing = computed(() => {
  if (!group.value || group.value.attendanceType === 'none') return null
  return getGroupPricingConfig(group.value)
})

const freePunchModeLabel = computed(() => {
  const mode = group.value?.freePunchConfig?.punchCountMode
  return freePunchCountModeOptions.find((o) => o.value === mode)?.label ?? '—'
})

const selectedVersion = ref<AttendanceGroupVersion | null>(null)

const versionDetailLines = computed(() =>
  selectedVersion.value ? summarizeVersionSnapshot(selectedVersion.value.snapshot) : [],
)

function viewVersionDetail(version: AttendanceGroupVersion) {
  selectedVersion.value = version
}

function closeVersionDetail() {
  selectedVersion.value = null
}

function assertAccessible(): AttendanceGroup | null {
  const g = group.value
  if (!g) {
    ElMessage.warning('考勤组不存在')
    router.replace('/enterprise-miniapp/attendance-groups')
    return null
  }
  const inEnterprise = store
    .getAttendanceGroupsByEnterprise(enterpriseId.value)
    .some((item) => item.id === g.id)
  if (!inEnterprise) {
    ElMessage.warning('无权访问该考勤组')
    router.replace('/enterprise-miniapp/attendance-groups')
    return null
  }
  return g
}

onMounted(() => assertAccessible())
watch(groupId, () => assertAccessible())

function goEdit() {
  router.push(`/enterprise-miniapp/attendance-groups/${groupId.value}/edit`)
}

async function toggleStatus() {
  const g = assertAccessible()
  if (!g) return
  store.toggleAttendanceGroupStatus(g.id)
  ElMessage.success(g.status === 'enabled' ? '已停用' : '已启用')
}

async function removeGroup() {
  const g = assertAccessible()
  if (!g) return
  try {
    await ElMessageBox.confirm(`确定删除考勤组「${g.name}」？`, '提示', { type: 'warning' })
    store.removeAttendanceGroup(g.id)
    ElMessage.success('已删除')
    router.replace('/enterprise-miniapp/attendance-groups')
  } catch {
    /* cancelled */
  }
}
</script>

<template>
  <div v-if="group" class="show-page">
    <EntMiniNavBar title="考勤组详情" back-to="/enterprise-miniapp/attendance-groups" />

    <div class="show-body">
      <!-- 1 基础信息 -->
      <section class="info-card">
        <h3 class="card-title">基础信息</h3>
        <div class="info-row">
          <span class="label">组名称</span>
          <span class="value">{{ group.name }}</span>
        </div>
        <div class="info-row">
          <span class="label">组编码</span>
          <span class="value">{{ group.code }}</span>
        </div>
        <div class="info-row">
          <span class="label">状态</span>
          <span class="value">{{ attendanceGroupStatusMap[group.status] }}</span>
        </div>
        <div class="info-row">
          <span class="label">考勤类型</span>
          <span class="value">{{ attendanceGroupTypeMap[group.attendanceType] }}</span>
        </div>
        <div class="info-row">
          <span class="label">当前版本</span>
          <span class="value">
            {{ group.currentVersion > 0 ? formatVersionLabel(group.currentVersion) : '未发布' }}
          </span>
        </div>
        <div v-if="group.description" class="info-row block">
          <span class="label">组描述</span>
          <span class="value">{{ group.description }}</span>
        </div>
      </section>

      <!-- 2 班次模版配置 -->
      <section v-if="group.attendanceType === 'shift'" class="info-card">
        <h3 class="card-title">班次模版配置</h3>
        <div v-if="group.shiftTemplates.length">
          <div v-for="(shift, idx) in group.shiftTemplates" :key="shift.id" class="shift-item">
            <strong>{{ idx + 1 }}. {{ shift.name || '未命名班次' }}</strong>
            <span>时段：{{ shift.startTime }} - {{ shift.endTime }}</span>
            <span>工时：{{ shift.workHours }}h</span>
            <span>休息规则：{{ shift.breakRule || '—' }}</span>
          </div>
        </div>
        <p v-else class="empty-text">暂无班次模版</p>
      </section>

      <!-- 3 自由打卡配置 -->
      <section v-if="group.attendanceType === 'free' && group.freePunchConfig" class="info-card">
        <h3 class="card-title">自由打卡配置</h3>
        <div class="info-row">
          <span class="label">打卡时段</span>
          <span class="value">
            {{ group.freePunchConfig.startTime }} 至 {{ group.freePunchConfig.endTime }}
          </span>
        </div>
        <div class="info-row">
          <span class="label">打卡次数</span>
          <span class="value">{{ freePunchModeLabel }}</span>
        </div>
        <div
          v-if="group.freePunchConfig.punchCountMode === 'clock_in_only'"
          class="info-row"
        >
          <span class="label">默认工时</span>
          <span class="value">{{ group.freePunchConfig.defaultWorkHours ?? '—' }} 小时</span>
        </div>
      </section>

      <!-- 4 考勤方式 -->
      <section v-if="group.attendanceType !== 'none'" class="info-card">
        <h3 class="card-title">考勤方式</h3>
        <div class="info-row">
          <span class="label">GPS 定位打卡</span>
          <span class="value">
            {{ group.gpsEnabled ? `已启用，半径 ${group.gpsRadiusMeters} 米` : '未启用' }}
          </span>
        </div>
        <template v-if="group.gpsEnabled">
          <p class="sub-label">打卡地点设置</p>
          <div v-if="group.punchLocations.length">
            <div v-for="loc in group.punchLocations" :key="loc.id" class="loc-item">
              <strong>{{ loc.name || '打卡地点' }}</strong>
              <span>{{ loc.address || '—' }}</span>
            </div>
          </div>
          <p v-else class="empty-text">未配置打卡地点</p>
        </template>
        <div class="info-row">
          <span class="label">WIFI 打卡</span>
          <span class="value">
            {{ group.wifiEnabled ? (group.wifiName || '已启用') : '未启用' }}
          </span>
        </div>
        <div class="info-row">
          <span class="label">扫码打卡</span>
          <span class="value">{{ group.qrcodeEnabled ? '已启用' : '未启用' }}</span>
        </div>
      </section>

      <!-- 5 合规工时红线 -->
      <section v-if="group.attendanceType === 'shift'" class="info-card">
        <h3 class="card-title">合规工时红线</h3>
        <div class="info-row">
          <span class="label">日最高工时</span>
          <span class="value">{{ group.compliance.maxDailyHours }} h</span>
        </div>
        <div class="info-row">
          <span class="label">周最高工时</span>
          <span class="value">{{ group.compliance.maxWeeklyHours }} h</span>
        </div>
        <div class="info-row">
          <span class="label">班次最小间隔</span>
          <span class="value">{{ group.compliance.minShiftIntervalHours }} h</span>
        </div>
        <div class="info-row">
          <span class="label">月最高工时</span>
          <span class="value">{{ group.compliance.maxMonthlyHours }} h</span>
        </div>
        <div class="info-row">
          <span class="label">最大连续工作</span>
          <span class="value">{{ group.compliance.maxConsecutiveWorkdays }} 天</span>
        </div>
        <div class="info-row">
          <span class="label">月最低在线</span>
          <span class="value">{{ formatMinMonthlyHours(group.minMonthlyOnlineHours) }}</span>
        </div>
      </section>

      <!-- 6 关联组织架构 -->
      <section class="info-card">
        <h3 class="card-title">关联组织架构</h3>
        <div v-if="group.departmentBindings.length">
          <div
            v-for="d in group.departmentBindings"
            :key="d.departmentId"
            class="dept-item"
          >
            <strong>{{ d.departmentName }}</strong>
            <span>人数：{{ d.headcount ?? 0 }} 人 [在职]</span>
            <span>负责人：{{ d.managerName || '—' }}</span>
          </div>
        </div>
        <p v-else class="empty-text">未关联部门</p>
      </section>

      <!-- 7 定价配置表 -->
      <section v-if="pricing" class="info-card">
        <h3 class="card-title">定价配置表</h3>
        <p class="sub-label">配置标准工时</p>
        <div class="info-row">
          <span class="label">白班时长</span>
          <span class="value">
            {{ formatDayShiftPeriod(pricing.dayShiftPeriod) }}
            （{{ getPeriodDurationHours(pricing.dayShiftPeriod) }}h）
          </span>
        </div>
        <div class="info-row">
          <span class="label">夜班时长</span>
          <span class="value">
            {{ formatNightShiftPeriod(pricing.nightShiftPeriod) }}
            （{{ getPeriodDurationHours(pricing.nightShiftPeriod) }}h）
          </span>
        </div>
        <p class="sub-label">单价配置</p>
        <div class="info-row">
          <span class="label">白班单价</span>
          <span class="value">{{ pricing.dayShiftRate }} 元/小时</span>
        </div>
        <div class="info-row">
          <span class="label">夜班单价</span>
          <span class="value">{{ pricing.nightShiftRate }} 元/小时</span>
        </div>
        <div class="info-row">
          <span class="label">周末单价</span>
          <span class="value">{{ formatVariablePrice(pricing.weekend, pricing.dayShiftRate) }}</span>
        </div>
        <div class="info-row">
          <span class="label">节假日单价</span>
          <span class="value">{{ formatVariablePrice(pricing.holiday, pricing.dayShiftRate) }}</span>
        </div>
        <div class="info-row">
          <span class="label">加班单价</span>
          <span class="value">{{ formatVariablePrice(pricing.overtime, pricing.dayShiftRate) }}</span>
        </div>
      </section>

      <!-- 版本历史 -->
      <section v-if="versionHistory.length" class="info-card">
        <h3 class="card-title">版本历史</h3>
        <div v-for="ver in versionHistory" :key="ver.id" class="version-item">
          <div class="version-head">
            <strong>{{ formatVersionLabel(ver.version) }}</strong>
            <span v-if="ver.isActive" class="active-badge">生效中</span>
            <span v-else class="history-badge">历史</span>
            <button type="button" class="link" @click="viewVersionDetail(ver)">查看配置</button>
          </div>
          <p class="version-meta">
            {{ formatVersionTime(ver.publishedAt) }}
            <span v-if="ver.changeNote"> · {{ ver.changeNote }}</span>
          </p>
        </div>
      </section>
    </div>

    <footer class="show-footer">
      <button type="button" class="ghost" @click="toggleStatus">
        {{ group.status === 'enabled' ? '停用' : '启用' }}
      </button>
      <button type="button" class="ghost danger" @click="removeGroup">删除</button>
      <button type="button" class="primary" @click="goEdit">编辑</button>
    </footer>

    <div v-if="selectedVersion" class="sheet-mask" @click.self="closeVersionDetail">
      <div class="sheet">
        <div class="sheet-head">
          <strong>{{ formatVersionLabel(selectedVersion.version) }} 配置详情</strong>
          <button type="button" class="close" @click="closeVersionDetail">×</button>
        </div>
        <p class="sheet-meta">
          发布时间：{{ formatVersionTime(selectedVersion.publishedAt) }}
          <span v-if="selectedVersion.isActive" class="active-badge">当前生效</span>
        </p>
        <p v-if="selectedVersion.changeNote" class="sheet-note">{{ selectedVersion.changeNote }}</p>
        <ul class="version-lines">
          <li v-for="(line, index) in versionDetailLines" :key="index">{{ line }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.show-page {
  min-height: 100%;
  padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
}

.show-body {
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-card {
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  box-shadow: var(--mini-shadow);
}

.card-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #374151;
}

.sub-label {
  margin: 10px 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
}

.info-row.block {
  flex-direction: column;
  gap: 4px;
}

.info-row .label {
  color: #9ca3af;
  flex-shrink: 0;
}

.info-row .value {
  color: #374151;
  text-align: right;
}

.info-row.block .value {
  text-align: left;
  line-height: 1.5;
}

.shift-item,
.loc-item,
.dept-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
  color: #6b7280;
}

.shift-item:last-child,
.loc-item:last-child,
.dept-item:last-child {
  border-bottom: none;
}

.shift-item strong,
.loc-item strong,
.dept-item strong {
  color: #374151;
}

.empty-text {
  margin: 0;
  font-size: 13px;
  color: #9ca3af;
}

.version-item {
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.version-item:last-child {
  border-bottom: none;
}

.version-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  flex-wrap: wrap;
}

.version-head .link {
  margin-left: auto;
  border: none;
  background: none;
  color: #228BFF;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}

.active-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #ecfdf5;
  color: #059669;
}

.history-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;
}

.version-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
}

.show-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  max-width: 430px;
  margin: 0 auto;
  display: flex;
  gap: 8px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #e5e7eb;
  background: #fff;
  box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.06);
}

.show-footer button {
  height: 42px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
}

.show-footer .ghost {
  flex: 0 0 auto;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
}

.show-footer .ghost.danger {
  color: #dc2626;
  border-color: #fecaca;
}

.show-footer .primary {
  flex: 1;
  border: none;
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}

.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-width: 430px;
  max-height: 75vh;
  overflow: auto;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.sheet-head .close {
  border: none;
  background: none;
  font-size: 22px;
  line-height: 1;
  color: #9ca3af;
  cursor: pointer;
}

.sheet-meta {
  margin: 0 0 8px;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sheet-note {
  margin: 0 0 10px;
  font-size: 13px;
  color: #4b5563;
}

.version-lines {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: #374151;
  line-height: 1.7;
}
</style>
