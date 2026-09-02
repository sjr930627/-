<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { formatVersionLabel } from '@/constants/attendanceGroup'
import {
  clonePricingConfig,
  createDefaultFreePunchConfig,
  createDefaultPricingConfig,
  freePunchCountModeOptions,
  getComplementPeriod,
  getPeriodDurationHours,
  normalizeFreePunchConfig,
  normalizePricingConfig,
  pricingConfigFromPayRule,
  pricingValueModeOptions,
} from '@/constants/attendanceGroupPricing'
import { getDefaultScheduleRuleForSeed } from '@/services/scheduleGroup'
import { countDepartmentEmployees, generateId } from '@/utils'
import type {
  AttendanceGroup,
  AttendanceGroupShiftTemplate,
  AttendanceGroupType,
  PunchLocation,
  VariablePriceConfig,
} from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const isCreate = computed(() => route.name === 'EntMiniAttendanceGroupCreate')
const groupId = computed(() => (isCreate.value ? null : String(route.params.id ?? '')))

const pageTitle = computed(() => (isCreate.value ? '新建考勤组' : '编辑考勤组'))

const backTo = computed(() =>
  isCreate.value
    ? '/enterprise-miniapp/attendance-groups'
    : `/enterprise-miniapp/attendance-groups/${groupId.value}`,
)

const existingGroup = computed(() =>
  groupId.value ? store.attendanceGroups.find((g) => g.id === groupId.value) : undefined,
)

const emptyShift = (): AttendanceGroupShiftTemplate => ({
  id: generateId('st'),
  name: '',
  startTime: '09:00',
  endTime: '18:00',
  breakRule: '上下午各休15分钟',
  workHours: 9,
})

const emptyLocation = (): PunchLocation => ({
  id: generateId('loc'),
  name: '',
  address: '',
})

function emptyForm(): Omit<
  AttendanceGroup,
  'id' | 'code' | 'createdAt' | 'updatedAt' | 'currentVersion' | 'versions'
> {
  return {
    name: '',
    description: '',
    status: 'enabled',
    attendanceType: 'shift',
    shiftTemplates: [emptyShift()],
    freePunchConfig: createDefaultFreePunchConfig(),
    gpsEnabled: true,
    gpsRadiusMeters: 500,
    punchLocations: [emptyLocation()],
    wifiEnabled: false,
    wifiName: '',
    qrcodeEnabled: true,
    compliance: {
      maxDailyHours: 12,
      maxWeeklyHours: 60,
      minShiftIntervalHours: 12,
      maxMonthlyHours: 260,
      maxConsecutiveWorkdays: 3,
    },
    scheduleRule: getDefaultScheduleRuleForSeed(),
    departmentBindings: [],
    payRule: {
      baseHourlyRate: 25,
      nightShiftSubsidy: 5,
      nightShiftTimeRange: '22:00-06:00',
      holidaySubsidy: 50,
    },
    pricingConfig: createDefaultPricingConfig(25),
    minMonthlyOnlineHours: 176,
    attendanceArea: '',
  }
}

const form = ref(emptyForm())
const selectedDeptIds = ref<string[]>([])
const selectedPricingTemplateId = ref('')
const saveTemplateOpen = ref(false)
const templateName = ref('')

const enterpriseDepartments = computed(() =>
  store.getDepartmentsByEnterprise(enterpriseId.value).filter((d) => d.orgType !== 'enterprise'),
)

const versionHint = computed(() => {
  if (isCreate.value) return '保存后可发布首版'
  const g = existingGroup.value
  if (!g) return ''
  return g.currentVersion > 0 ? `当前 ${formatVersionLabel(g.currentVersion)}` : '尚未发布'
})

const pricingTableRows = computed(() => {
  const cfg = form.value.pricingConfig
  if (!cfg) return []
  return [
    { key: 'weekend', label: '周末单价', config: cfg.weekend },
    { key: 'holiday', label: '节假日单价', config: cfg.holiday },
    { key: 'overtime', label: '加班单价', config: cfg.overtime },
  ]
})

function ensurePricingConfig() {
  if (form.value.attendanceType === 'none') {
    delete form.value.pricingConfig
    return
  }
  if (!form.value.pricingConfig) {
    form.value.pricingConfig = pricingConfigFromPayRule(form.value.payRule)
  }
  form.value.pricingConfig = normalizePricingConfig(form.value.pricingConfig)
}

function ensureFreePunchConfig() {
  if (!form.value.freePunchConfig) {
    form.value.freePunchConfig = createDefaultFreePunchConfig()
  } else {
    form.value.freePunchConfig = normalizeFreePunchConfig(form.value.freePunchConfig)
  }
}

function hydrateFromGroup(group: AttendanceGroup) {
  form.value = JSON.parse(JSON.stringify({
    name: group.name,
    description: group.description,
    status: group.status,
    attendanceType: group.attendanceType,
    shiftTemplates: group.shiftTemplates,
    freePunchConfig: group.freePunchConfig,
    gpsEnabled: group.gpsEnabled,
    gpsRadiusMeters: group.gpsRadiusMeters,
    punchLocations: group.punchLocations.length ? group.punchLocations : [emptyLocation()],
    wifiEnabled: group.wifiEnabled,
    wifiName: group.wifiName,
    qrcodeEnabled: group.qrcodeEnabled,
    compliance: group.compliance,
    scheduleRule: group.scheduleRule,
    departmentBindings: group.departmentBindings,
    payRule: group.payRule,
    pricingConfig: group.pricingConfig,
    minMonthlyOnlineHours: group.minMonthlyOnlineHours,
    attendanceArea: group.attendanceArea,
  }))
  if (form.value.attendanceType === 'none') {
    delete form.value.pricingConfig
  } else {
    if (!form.value.pricingConfig) {
      form.value.pricingConfig = pricingConfigFromPayRule(form.value.payRule)
    }
    form.value.pricingConfig = normalizePricingConfig(form.value.pricingConfig)
  }
  if (form.value.attendanceType === 'free') {
    ensureFreePunchConfig()
  }
  selectedDeptIds.value = form.value.departmentBindings.map((b) => b.departmentId)
}

function loadGroup() {
  if (isCreate.value) {
    form.value = emptyForm()
    selectedDeptIds.value = []
    selectedPricingTemplateId.value = ''
    ensurePricingConfig()
    return
  }
  const group = existingGroup.value
  if (!group) {
    ElMessage.warning('考勤组不存在')
    router.replace('/enterprise-miniapp/attendance-groups')
    return
  }
  const inEnterprise = store
    .getAttendanceGroupsByEnterprise(enterpriseId.value)
    .some((g) => g.id === group.id)
  if (!inEnterprise) {
    ElMessage.warning('无权访问该考勤组')
    router.replace('/enterprise-miniapp/attendance-groups')
    return
  }
  hydrateFromGroup(group)
}

onMounted(loadGroup)
watch(groupId, loadGroup)

watch(
  () => form.value.attendanceType,
  (type: AttendanceGroupType) => {
    if (type === 'none') {
      delete form.value.pricingConfig
    } else {
      ensurePricingConfig()
    }
    if (type === 'free') ensureFreePunchConfig()
    if (type === 'shift' && !form.value.shiftTemplates.length) {
      form.value.shiftTemplates = [emptyShift()]
    }
  },
)

function syncDepartmentBindings() {
  form.value.departmentBindings = selectedDeptIds.value.map((id) => {
    const dept = store.departments.find((d) => d.id === id)
    const existing = form.value.departmentBindings.find((b) => b.departmentId === id)
    return {
      departmentId: id,
      departmentName: dept?.name ?? id,
      headcount: countDepartmentEmployees(store.departments, store.employees, id, true),
      managerName: existing?.managerName,
    }
  })
}

watch(selectedDeptIds, syncDepartmentBindings, { deep: true })

function addShiftTemplate() {
  form.value.shiftTemplates.push(emptyShift())
}

function removeShiftTemplate(index: number) {
  if (form.value.shiftTemplates.length <= 1) {
    ElMessage.warning('至少保留一个班次')
    return
  }
  form.value.shiftTemplates.splice(index, 1)
}

function addLocation() {
  form.value.punchLocations.push(emptyLocation())
}

function removeLocation(index: number) {
  if (form.value.punchLocations.length <= 1) {
    ElMessage.warning('至少保留一个打卡地点')
    return
  }
  form.value.punchLocations.splice(index, 1)
}

function onDayShiftPeriodChange() {
  if (!form.value.pricingConfig?.dayShiftPeriod) return
  form.value.pricingConfig.nightShiftPeriod = getComplementPeriod(
    form.value.pricingConfig.dayShiftPeriod,
  )
}

function onNightShiftPeriodChange() {
  if (!form.value.pricingConfig?.nightShiftPeriod) return
  form.value.pricingConfig.dayShiftPeriod = getComplementPeriod(
    form.value.pricingConfig.nightShiftPeriod,
  )
}

function onVariableModeChange(config: VariablePriceConfig) {
  if (config.mode === 'fixed') {
    config.fixedAmount = config.fixedAmount ?? form.value.pricingConfig!.dayShiftRate
    delete config.multiplier
  } else {
    config.multiplier = config.multiplier ?? 1.5
    delete config.fixedAmount
  }
}

function applyPricingTemplate(id: string) {
  if (!id) return
  const template = store.pricingTemplates.find((t) => t.id === id)
  if (!template) return
  form.value.pricingConfig = clonePricingConfig(template.config)
  ElMessage.success(`已应用定价模版「${template.name}」`)
}

function openSaveTemplate() {
  ensurePricingConfig()
  templateName.value = ''
  saveTemplateOpen.value = true
}

function confirmSaveTemplate() {
  if (!templateName.value.trim()) {
    ElMessage.warning('请填写模版名称')
    return
  }
  try {
    ensurePricingConfig()
    const item = store.addPricingTemplate(templateName.value, form.value.pricingConfig!)
    selectedPricingTemplateId.value = item.id
    saveTemplateOpen.value = false
    ElMessage.success('定价模版已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

function validate() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写组名称')
    return false
  }
  if (form.value.attendanceType === 'shift' && !form.value.shiftTemplates.length) {
    ElMessage.warning('排班制至少配置一个班次')
    return false
  }
  if (form.value.attendanceType === 'free' && form.value.freePunchConfig) {
    if (!form.value.freePunchConfig.startTime || !form.value.freePunchConfig.endTime) {
      ElMessage.warning('请配置自由打卡时段')
      return false
    }
    if (form.value.freePunchConfig.punchCountMode === 'clock_in_only') {
      const hours = form.value.freePunchConfig.defaultWorkHours
      if (hours == null || hours <= 0) {
        ElMessage.warning('仅上班打卡需填写默认工时')
        return false
      }
    }
  }
  if (form.value.attendanceType !== 'none') {
    ensurePricingConfig()
  }
  syncDepartmentBindings()
  return true
}

function preparePayload() {
  const payload = { ...form.value }
  if (payload.attendanceType !== 'free') {
    delete payload.freePunchConfig
  } else if (payload.freePunchConfig) {
    payload.freePunchConfig = normalizeFreePunchConfig(payload.freePunchConfig)
  }
  if (payload.attendanceType === 'none') {
    delete payload.pricingConfig
  } else if (payload.pricingConfig) {
    payload.pricingConfig = normalizePricingConfig(payload.pricingConfig)
    // 同步兼容字段，供仍读取 payRule 的下游逻辑使用
    payload.payRule = {
      ...payload.payRule,
      baseHourlyRate: payload.pricingConfig.dayShiftRate,
      nightShiftSubsidy: Math.max(
        0,
        Math.round((payload.pricingConfig.nightShiftRate - payload.pricingConfig.dayShiftRate) * 100) /
          100,
      ),
      nightShiftTimeRange: `${payload.pricingConfig.nightShiftPeriod.startTime}-${payload.pricingConfig.nightShiftPeriod.endTime}`,
    }
  }
  return payload
}

function saveDraft() {
  if (!validate()) return
  const payload = preparePayload()
  try {
    if (isCreate.value) {
      const item = store.addAttendanceGroup({ ...payload, status: payload.status })
      ElMessage.success('创建成功')
      router.replace(`/enterprise-miniapp/attendance-groups/${item.id}/edit`)
    } else if (groupId.value) {
      store.updateAttendanceGroup(groupId.value, payload)
      ElMessage.success('保存成功')
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

function publish() {
  if (!validate()) return
  const payload = preparePayload()
  try {
    if (isCreate.value) {
      const item = store.addAttendanceGroup({ ...payload, status: 'enabled' })
      const record = store.publishAttendanceGroup(item.id, {}, '企业小程序首次发布')
      ElMessage.success(`已创建并发布 ${formatVersionLabel(record.version)}`)
      router.replace(`/enterprise-miniapp/attendance-groups/${item.id}`)
    } else if (groupId.value) {
      const record = store.publishAttendanceGroup(groupId.value, payload)
      ElMessage.success(`已发布 ${formatVersionLabel(record.version)} 并生效`)
      router.replace(`/enterprise-miniapp/attendance-groups/${groupId.value}`)
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '发布失败')
  }
}
</script>

<template>
  <div class="detail-page">
    <EntMiniNavBar :title="pageTitle" :back-to="backTo" />

    <div class="detail-body">
      <p v-if="versionHint" class="version-hint">{{ versionHint }}</p>

      <!-- 1 基础信息 -->
      <section class="form-section">
        <h3 class="section-title">基础信息</h3>
        <label>组名称</label>
        <input v-model="form.name" type="text" placeholder="如：县区考勤组">

        <label>状态</label>
        <select v-model="form.status">
          <option value="enabled">启用</option>
          <option value="disabled">停用</option>
        </select>

        <label>组描述</label>
        <textarea v-model="form.description" rows="2" placeholder="可选" />

        <label>考勤类型</label>
        <select v-model="form.attendanceType">
          <option value="shift">排班制</option>
          <option value="free">自由打卡</option>
          <option value="none">无需打卡</option>
        </select>
      </section>

      <!-- 2 班次模版 -->
      <section v-if="form.attendanceType === 'shift'" class="form-section">
        <div class="section-head">
          <h3 class="section-title">班次模版配置</h3>
          <button type="button" class="link" @click="addShiftTemplate">+ 添加班次</button>
        </div>
        <div v-for="(shift, idx) in form.shiftTemplates" :key="shift.id" class="sub-card">
          <label>班次名称</label>
          <input v-model="shift.name" type="text" placeholder="早班">
          <label>时段</label>
          <div class="row-2">
            <input v-model="shift.startTime" type="time">
            <input v-model="shift.endTime" type="time">
          </div>
          <label>休息规则</label>
          <input v-model="shift.breakRule" type="text" placeholder="上下午各休15分钟">
          <label>工时（小时）</label>
          <input v-model.number="shift.workHours" type="number" min="1" max="24" step="0.5">
          <button
            v-if="form.shiftTemplates.length > 1"
            type="button"
            class="link danger"
            @click="removeShiftTemplate(idx)"
          >
            删除班次
          </button>
        </div>
      </section>

      <!-- 3 自由打卡 -->
      <section v-if="form.attendanceType === 'free' && form.freePunchConfig" class="form-section">
        <h3 class="section-title">自由打卡配置</h3>
        <label>打卡时段</label>
        <div class="row-2">
          <input v-model="form.freePunchConfig.startTime" type="time">
          <input v-model="form.freePunchConfig.endTime" type="time">
        </div>
        <label>打卡次数</label>
        <div class="radio-row">
          <label
            v-for="opt in freePunchCountModeOptions"
            :key="opt.value"
            class="radio-item"
          >
            <input
              v-model="form.freePunchConfig.punchCountMode"
              type="radio"
              :value="opt.value"
              @change="ensureFreePunchConfig()"
            >
            {{ opt.label }}
          </label>
        </div>
        <template v-if="form.freePunchConfig.punchCountMode === 'clock_in_only'">
          <label>默认工时（小时）</label>
          <input
            v-model.number="form.freePunchConfig.defaultWorkHours"
            type="number"
            min="0.5"
            max="24"
            step="0.5"
          >
          <p class="hint">仅上班打卡时按此默认工时计薪</p>
        </template>
      </section>

      <!-- 4 考勤方式 -->
      <section v-if="form.attendanceType !== 'none'" class="form-section">
        <h3 class="section-title">考勤方式</h3>
        <label class="inline-check">
          <input v-model="form.gpsEnabled" type="checkbox">
          GPS 定位打卡
        </label>
        <template v-if="form.gpsEnabled">
          <label>允许半径（米）</label>
          <input v-model.number="form.gpsRadiusMeters" type="number" min="100" max="5000" step="100">
          <div class="section-head">
            <span class="sub-label">打卡地点</span>
            <button type="button" class="link" @click="addLocation">+ 添加</button>
          </div>
          <div v-for="(loc, idx) in form.punchLocations" :key="loc.id" class="sub-card">
            <input v-model="loc.name" type="text" placeholder="地点名称">
            <input v-model="loc.address" type="text" placeholder="详细地址">
            <button
              v-if="form.punchLocations.length > 1"
              type="button"
              class="link danger"
              @click="removeLocation(idx)"
            >
              删除地点
            </button>
          </div>
        </template>
        <label class="inline-check">
          <input v-model="form.wifiEnabled" type="checkbox">
          WIFI 打卡
        </label>
        <input
          v-if="form.wifiEnabled"
          v-model="form.wifiName"
          type="text"
          placeholder="WIFI 名称"
        >
        <label class="inline-check">
          <input v-model="form.qrcodeEnabled" type="checkbox">
          扫码打卡
        </label>
        <p class="hint">支持扫描二维码或滑动验证</p>
      </section>

      <!-- 5 合规工时红线 -->
      <section v-if="form.attendanceType === 'shift'" class="form-section">
        <h3 class="section-title">合规工时红线</h3>
        <div class="row-2">
          <div>
            <label>日最高工时</label>
            <input v-model.number="form.compliance.maxDailyHours" type="number" min="1" max="24">
          </div>
          <div>
            <label>周最高工时</label>
            <input v-model.number="form.compliance.maxWeeklyHours" type="number" min="1" max="168">
          </div>
        </div>
        <div class="row-2">
          <div>
            <label>班次最小间隔</label>
            <input v-model.number="form.compliance.minShiftIntervalHours" type="number" min="1" max="48">
          </div>
          <div>
            <label>月最高工时</label>
            <input v-model.number="form.compliance.maxMonthlyHours" type="number" min="1" max="400">
          </div>
        </div>
        <div class="row-2">
          <div>
            <label>最大连续工作（天）</label>
            <input v-model.number="form.compliance.maxConsecutiveWorkdays" type="number" min="1" max="14">
          </div>
          <div>
            <label>月最低在线（小时）</label>
            <input v-model.number="form.minMonthlyOnlineHours" type="number" min="0" max="400">
          </div>
        </div>
        <p class="hint">月最低在线填 0 表示不限制</p>
      </section>

      <!-- 6 关联组织 -->
      <section class="form-section">
        <h3 class="section-title">关联组织架构</h3>
        <div class="dept-list">
          <label v-for="d in enterpriseDepartments" :key="d.id" class="dept-check">
            <input v-model="selectedDeptIds" type="checkbox" :value="d.id">
            <span>{{ d.name }}</span>
          </label>
        </div>
        <div
          v-for="b in form.departmentBindings"
          :key="b.departmentId"
          class="dept-bind"
        >
          <div class="dept-bind-head">
            <strong>{{ b.departmentName }}</strong>
            <span>{{ b.headcount }} 人</span>
          </div>
          <input v-model="b.managerName" type="text" placeholder="负责人（可选）">
        </div>
        <p v-if="!enterpriseDepartments.length" class="hint">本企业暂无可选部门</p>
      </section>

      <!-- 7 定价配置表 -->
      <section v-if="form.pricingConfig && form.attendanceType !== 'none'" class="form-section">
        <h3 class="section-title">定价配置表</h3>

        <label>定价模版</label>
        <select
          :value="selectedPricingTemplateId"
          @change="applyPricingTemplate(($event.target as HTMLSelectElement).value)"
        >
          <option value="">选择定价模版</option>
          <option v-for="tpl in store.pricingTemplates" :key="tpl.id" :value="tpl.id">
            {{ tpl.name }}
          </option>
        </select>
        <button type="button" class="link" @click="openSaveTemplate">保存为定价模版</button>

        <p class="sub-label">配置标准工时</p>
        <label>白班时长</label>
        <div class="row-2">
          <input
            v-model="form.pricingConfig.dayShiftPeriod.startTime"
            type="time"
            @change="onDayShiftPeriodChange"
          >
          <input
            v-model="form.pricingConfig.dayShiftPeriod.endTime"
            type="time"
            @change="onDayShiftPeriodChange"
          >
        </div>
        <p class="hint">{{ getPeriodDurationHours(form.pricingConfig.dayShiftPeriod) }}h</p>

        <label>夜班时长</label>
        <div class="row-2">
          <input
            v-model="form.pricingConfig.nightShiftPeriod.startTime"
            type="time"
            @change="onNightShiftPeriodChange"
          >
          <input
            v-model="form.pricingConfig.nightShiftPeriod.endTime"
            type="time"
            @change="onNightShiftPeriodChange"
          >
        </div>
        <p class="hint">{{ getPeriodDurationHours(form.pricingConfig.nightShiftPeriod) }}h</p>

        <p class="sub-label">单价配置</p>
        <div class="row-2">
          <div>
            <label>白班单价（元/小时）</label>
            <input v-model.number="form.pricingConfig.dayShiftRate" type="number" min="0" step="0.1">
          </div>
          <div>
            <label>夜班单价（元/小时）</label>
            <input v-model.number="form.pricingConfig.nightShiftRate" type="number" min="0" step="0.1">
          </div>
        </div>

        <div v-for="row in pricingTableRows" :key="row.key" class="var-price">
          <strong>{{ row.label }}</strong>
          <div class="radio-row">
            <label
              v-for="opt in pricingValueModeOptions"
              :key="opt.value"
              class="radio-item"
            >
              <input
                v-model="row.config.mode"
                type="radio"
                :value="opt.value"
                @change="onVariableModeChange(row.config)"
              >
              {{ opt.label }}
            </label>
          </div>
          <template v-if="row.config.mode === 'fixed'">
            <label>固定金额（元/小时）</label>
            <input v-model.number="row.config.fixedAmount" type="number" min="0" step="0.1">
          </template>
          <template v-else>
            <label>倍数（基于白班单价）</label>
            <input
              v-model.number="row.config.multiplier"
              type="number"
              min="0.1"
              max="10"
              step="0.1"
            >
          </template>
        </div>
      </section>
    </div>

    <footer class="detail-footer">
      <button type="button" @click="saveDraft">保存</button>
      <button type="button" class="primary" @click="publish">立即生效并发布</button>
    </footer>

    <div v-if="saveTemplateOpen" class="sheet-mask" @click.self="saveTemplateOpen = false">
      <div class="sheet">
        <header>
          <strong>保存定价模版</strong>
          <button type="button" class="close" @click="saveTemplateOpen = false">×</button>
        </header>
        <p class="sheet-hint">将保存当前定价配置表全部内容</p>
        <label>模版名称</label>
        <input v-model="templateName" type="text" maxlength="30" placeholder="如：标准白班定价">
        <button type="button" class="submit" @click="confirmSaveTemplate">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100%;
  padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
}

.detail-body {
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.version-hint {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}

.form-section {
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  box-shadow: var(--mini-shadow);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-section > label,
.sub-card > label,
.var-price > label,
.sheet label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.form-section input,
.form-section select,
.form-section textarea,
.sheet input {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #374151;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sub-label {
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
  margin-top: 6px;
}

.sub-card,
.var-price,
.dept-bind {
  background: #f9fafb;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.row-2 > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.dept-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow: auto;
}

.dept-check,
.inline-check,
.radio-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #374151;
}

.dept-check input,
.inline-check input,
.radio-item input {
  width: auto;
}

.radio-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.dept-bind-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #374151;
}

.hint {
  margin: 0;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.4;
}

.link {
  border: none;
  background: none;
  color: var(--app-primary, var(--mini-primary));
  font-size: 12px;
  padding: 0;
  align-self: flex-start;
  cursor: pointer;
}

.link.danger {
  color: #dc2626;
}

.detail-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  max-width: 430px;
  margin: 0 auto;
  display: flex;
  gap: 10px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #e5e7eb;
  background: #fff;
  box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.06);
}

.detail-footer button {
  flex: 1;
  height: 42px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
}

.detail-footer .primary {
  border: none;
  background: var(--app-primary, var(--mini-primary));
  color: #fff;
  font-weight: 600;
}

.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: min(420px, 100%);
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sheet header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sheet .close {
  border: none;
  background: none;
  font-size: 22px;
  color: #9ca3af;
}

.sheet-hint {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
}

.submit {
  margin-top: 4px;
  height: 42px;
  border: none;
  border-radius: 10px;
  background: var(--app-primary, var(--mini-primary));
  color: #fff;
  font-weight: 600;
}
</style>
