<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { getDefaultScheduleRuleForSeed } from '@/services/scheduleGroup'
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
import { countDepartmentEmployees, generateId } from '@/utils'
import { formatVersionLabel } from '@/constants/attendanceGroup'
import type {
  AttendanceGroup,
  AttendanceGroupShiftTemplate,
  AttendanceGroupType,
  PunchLocation,
  VariablePriceConfig,
} from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const isEdit = computed(() => Boolean(route.params.id))
const groupId = computed(() => route.params.id as string | undefined)

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

const form = ref<Omit<AttendanceGroup, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'currentVersion' | 'versions'>>({
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
})

const deptPickerVisible = ref(false)
const selectedDeptIds = ref<string[]>([])
const selectedPricingTemplateId = ref('')
const saveTemplateVisible = ref(false)
const templateName = ref('')

const sectionNums = computed(() => {
  let n = 1
  const nums = {
    basic: n++,
    shift: 0,
    freePunch: 0,
    method: 0,
    compliance: 0,
    dept: 0,
    pricing: 0,
  }
  if (form.value.attendanceType === 'shift') nums.shift = n++
  if (form.value.attendanceType === 'free') nums.freePunch = n++
  if (form.value.attendanceType !== 'none') nums.method = n++
  if (form.value.attendanceType === 'shift') nums.compliance = n++
  nums.dept = n++
  if (form.value.attendanceType !== 'none') nums.pricing = n
  return nums
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

function hydrateForm(source: AttendanceGroup) {
  form.value = JSON.parse(JSON.stringify(source))
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
}

const currentGroup = computed(() =>
  isEdit.value && groupId.value
    ? store.attendanceGroups.find((g) => g.id === groupId.value)
    : null,
)

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

const pricingTableRows = computed(() => {
  const cfg = form.value.pricingConfig
  if (!cfg) return []
  return [
    { key: 'weekend', label: '周末单价', config: cfg.weekend },
    { key: 'holiday', label: '节假日单价', config: cfg.holiday },
    { key: 'overtime', label: '加班单价', config: cfg.overtime },
  ]
})

function onDayShiftPeriodChange() {
  if (!form.value.pricingConfig?.dayShiftPeriod) return
  form.value.pricingConfig.nightShiftPeriod = getComplementPeriod(form.value.pricingConfig.dayShiftPeriod)
}

function onNightShiftPeriodChange() {
  if (!form.value.pricingConfig?.nightShiftPeriod) return
  form.value.pricingConfig.dayShiftPeriod = getComplementPeriod(form.value.pricingConfig.nightShiftPeriod)
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

onMounted(() => {
  if (isEdit.value && groupId.value) {
    const source = store.attendanceGroups.find((g) => g.id === groupId.value)
    if (source) {
      hydrateForm(source)
    } else {
      ElMessage.error('考勤组不存在')
      router.replace('/attendance-groups')
    }
  } else {
    ensurePricingConfig()
  }
})

function addShift() {
  form.value.shiftTemplates.push(emptyShift())
}

function removeShift(index: number) {
  form.value.shiftTemplates.splice(index, 1)
}

function addLocation() {
  form.value.punchLocations.push(emptyLocation())
}

function removeLocation(index: number) {
  form.value.punchLocations.splice(index, 1)
}

function openDeptPicker() {
  selectedDeptIds.value = form.value.departmentBindings.map((b) => b.departmentId)
  deptPickerVisible.value = true
}

function confirmDepts() {
  form.value.departmentBindings = selectedDeptIds.value.map((id) => {
    const dept = store.departments.find((d) => d.id === id)!
    const existing = form.value.departmentBindings.find((b) => b.departmentId === id)
    return {
      departmentId: id,
      departmentName: dept.name,
      headcount: countDepartmentEmployees(store.departments, store.employees, id, true),
      managerName: existing?.managerName,
    }
  })
  deptPickerVisible.value = false
}

function removeDeptBinding(deptId: string) {
  form.value.departmentBindings = form.value.departmentBindings.filter(
    (b) => b.departmentId !== deptId,
  )
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
  }
  return payload
}

function save(publish = false) {
  if (!validate()) return
  const payload = preparePayload()
  try {
    if (isEdit.value && groupId.value) {
      if (publish) {
        const record = store.publishAttendanceGroup(groupId.value, payload)
        ElMessage.success(`已发布 V${record.version} 并生效`)
      } else {
        store.updateAttendanceGroup(groupId.value, payload)
        ElMessage.success('保存成功')
      }
    } else if (publish) {
      store.publishNewAttendanceGroup({ ...payload, status: 'enabled' })
      ElMessage.success('已创建并发布 V1')
      router.push('/attendance-groups')
      return
    } else {
      const item = store.addAttendanceGroup({
        ...payload,
        status: form.value.status,
      })
      ElMessage.success('创建成功')
      router.replace(`/attendance-groups/${item.id}/edit`)
      return
    }
    if (publish) router.push('/attendance-groups')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

function cancel() {
  router.push('/attendance-groups')
}

function applyPricingTemplate(id: string) {
  if (!id) return
  const template = store.pricingTemplates.find((t) => t.id === id)
  if (!template) return
  form.value.pricingConfig = clonePricingConfig(template.config)
  ElMessage.success(`已应用定价模版「${template.name}」`)
}

function openSaveTemplateDialog() {
  ensurePricingConfig()
  templateName.value = ''
  saveTemplateVisible.value = true
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
    saveTemplateVisible.value = false
    ElMessage.success('定价模版已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}
</script>

<template>
  <div class="form-page">
    <div class="form-top-bar page-card">
      <div>
        <h2 class="page-title">{{ isEdit ? '编辑考勤组' : '新建考勤组' }}</h2>
        <p class="text-muted">
          支持排班制、自由打卡、无需打卡三种考勤类型
          <template v-if="currentGroup && currentGroup.currentVersion > 0">
            · 当前生效 {{ formatVersionLabel(currentGroup.currentVersion) }}
          </template>
        </p>
      </div>
      <div class="top-actions">
        <el-button @click="cancel">取消</el-button>
        <el-button @click="save(false)">保存</el-button>
        <el-button type="primary" @click="save(true)">立即生效并发布</el-button>
      </div>
    </div>

    <!-- 1 基础信息 -->
    <div class="section-card page-card">
      <div class="section-header">
        <span class="section-num" :class="`section-num--${sectionNums.basic}`">{{ sectionNums.basic }}</span>
        <span class="section-title">基础信息</span>
      </div>
      <el-form label-width="100px" class="section-form">
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="组名称" required>
              <el-input v-model="form.name" placeholder="如：县区考勤组" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio value="enabled">启用</el-radio>
                <el-radio value="disabled">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="组描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="考勤类型">
          <el-radio-group v-model="form.attendanceType">
            <el-radio value="shift">排班制</el-radio>
            <el-radio value="free">自由打卡</el-radio>
            <el-radio value="none">无需打卡</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </div>

    <!-- 班次模版：仅排班制 -->
    <div v-if="form.attendanceType === 'shift'" class="section-card page-card">
      <div class="section-header">
        <span class="section-num" :class="`section-num--${sectionNums.shift}`">{{ sectionNums.shift }}</span>
        <span class="section-title">班次模版配置</span>
        <el-button type="primary" link @click="addShift">+ 添加班次</el-button>
      </div>
      <el-table :data="form.shiftTemplates" border stripe size="small">
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column label="班次名称" width="120">
          <template #default="{ row }">
            <el-input v-model="row.name" size="small" placeholder="早班" />
          </template>
        </el-table-column>
        <el-table-column label="时段" min-width="200">
          <template #default="{ row }">
            <el-time-select v-model="row.startTime" start="00:00" step="00:30" end="23:30" size="small" style="width: 100px" />
            <span style="margin: 0 6px">-</span>
            <el-time-select v-model="row.endTime" start="00:00" step="00:30" end="23:30" size="small" style="width: 100px" />
            <span class="field-hint">{{ row.workHours }}h</span>
          </template>
        </el-table-column>
        <el-table-column label="休息规则" min-width="180">
          <template #default="{ row }">
            <el-input v-model="row.breakRule" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="工时" width="90">
          <template #default="{ row }">
            <el-input-number v-model="row.workHours" :min="1" :max="24" size="small" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ $index }">
            <el-button link type="danger" :disabled="form.shiftTemplates.length <= 1" @click="removeShift($index)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 自由打卡配置：仅自由打卡 -->
    <div v-if="form.attendanceType === 'free' && form.freePunchConfig" class="section-card page-card">
      <div class="section-header">
        <span class="section-num" :class="`section-num--${sectionNums.freePunch}`">{{ sectionNums.freePunch }}</span>
        <span class="section-title">自由打卡配置</span>
      </div>
      <el-form label-width="100px" class="section-form">
        <el-form-item label="打卡时段">
          <el-time-select
            v-model="form.freePunchConfig.startTime"
            start="00:00"
            step="00:30"
            end="23:30"
            placeholder="开始"
            style="width: 120px"
          />
          <span class="time-sep">至</span>
          <el-time-select
            v-model="form.freePunchConfig.endTime"
            start="00:00"
            step="00:30"
            end="23:30"
            placeholder="结束"
            style="width: 120px"
          />
        </el-form-item>
        <el-form-item label="打卡次数">
          <el-radio-group
            v-model="form.freePunchConfig.punchCountMode"
            @change="ensureFreePunchConfig()"
          >
            <el-radio
              v-for="opt in freePunchCountModeOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item
          v-if="form.freePunchConfig.punchCountMode === 'clock_in_only'"
          label="默认工时"
          required
        >
          <el-input-number
            v-model="form.freePunchConfig.defaultWorkHours"
            :min="0.5"
            :max="24"
            :step="0.5"
            :precision="1"
          />
          <span class="field-hint">小时（仅上班打卡时按此默认工时计薪）</span>
        </el-form-item>
      </el-form>
    </div>

    <!-- 考勤方式：排班制 & 自由打卡 -->
    <div v-if="form.attendanceType !== 'none'" class="section-card page-card">
      <div class="section-header">
        <span class="section-num" :class="`section-num--${sectionNums.method}`">{{ sectionNums.method }}</span>
        <span class="section-title">考勤方式</span>
      </div>
      <div class="method-block">
        <el-checkbox v-model="form.gpsEnabled">GPS 定位打卡</el-checkbox>
        <span v-if="form.gpsEnabled" class="inline-field">
          允许半径
          <el-input-number v-model="form.gpsRadiusMeters" :min="100" :max="5000" :step="100" size="small" />
          米
        </span>
      </div>
      <div v-if="form.gpsEnabled" class="sub-block">
        <div class="sub-header">
          <span>打卡地点设置</span>
          <el-button size="small" @click="addLocation">+ 添加打卡点</el-button>
        </div>
        <el-table :data="form.punchLocations" border size="small">
          <el-table-column label="地点名称">
            <template #default="{ row }">
              <el-input v-model="row.name" size="small" placeholder="总部大楼" />
            </template>
          </el-table-column>
          <el-table-column label="地址">
            <template #default="{ row }">
              <el-input v-model="row.address" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70">
            <template #default="{ $index }">
              <el-button link type="danger" @click="removeLocation($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="method-block">
        <el-checkbox v-model="form.wifiEnabled">WIFI 打卡</el-checkbox>
        <el-input
          v-if="form.wifiEnabled"
          v-model="form.wifiName"
          placeholder="WIFI 名称"
          style="width: 200px; margin-left: 12px"
          size="small"
        />
      </div>
      <div class="method-block">
        <el-checkbox v-model="form.qrcodeEnabled">扫码打卡</el-checkbox>
        <span class="field-hint">支持扫描二维码或滑动验证</span>
      </div>
    </div>

    <!-- 合规工时红线：仅排班制 -->
    <div v-if="form.attendanceType === 'shift'" class="section-card page-card">
      <div class="section-header">
        <span class="section-num" :class="`section-num--${sectionNums.compliance}`">{{ sectionNums.compliance }}</span>
        <span class="section-title">合规工时红线</span>
      </div>
      <el-row :gutter="24">
        <el-col :span="8">
          <el-form-item label="日最高工时">
            <el-input-number v-model="form.compliance.maxDailyHours" :min="1" :max="24" /> h
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="周最高工时">
            <el-input-number v-model="form.compliance.maxWeeklyHours" :min="1" :max="168" /> h
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="班次最小间隔">
            <el-input-number v-model="form.compliance.minShiftIntervalHours" :min="1" :max="48" /> h
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="月最高工时">
            <el-input-number v-model="form.compliance.maxMonthlyHours" :min="1" :max="400" /> h
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="最大连续工作">
            <el-input-number v-model="form.compliance.maxConsecutiveWorkdays" :min="1" :max="14" /> 天
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="月最低在线">
            <el-input-number v-model="form.minMonthlyOnlineHours" :min="0" :max="400" />
            <span class="field-hint">小时，0 表示不限制</span>
          </el-form-item>
        </el-col>
      </el-row>
    </div>

    <!-- 关联组织架构 -->
    <div class="section-card page-card">
      <div class="section-header">
        <span class="section-num" :class="`section-num--${sectionNums.dept}`">{{ sectionNums.dept }}</span>
        <span class="section-title">关联组织架构</span>
        <el-button type="primary" link @click="openDeptPicker">+ 添加部门</el-button>
      </div>
      <el-table :data="form.departmentBindings" border stripe size="small">
        <el-table-column prop="departmentName" label="部门" min-width="160" />
        <el-table-column label="人数" width="140">
          <template #default="{ row }">{{ row.headcount }} 人 [在职]</template>
        </el-table-column>
        <el-table-column label="负责人" width="120">
          <template #default="{ row }">
            <el-input v-model="row.managerName" size="small" placeholder="负责人" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button link type="danger" @click="removeDeptBinding(row.departmentId)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 定价配置表：无需打卡不展示 -->
    <div v-if="form.pricingConfig && form.attendanceType !== 'none'" class="section-card page-card">
      <div class="section-header">
        <span class="section-num" :class="`section-num--${sectionNums.pricing}`">{{ sectionNums.pricing }}</span>
        <span class="section-title">定价配置表</span>
        <div class="pricing-toolbar">
          <el-select
            v-model="selectedPricingTemplateId"
            placeholder="选择定价模版"
            clearable
            filterable
            style="width: 220px"
            @change="applyPricingTemplate"
          >
            <el-option
              v-for="tpl in store.pricingTemplates"
              :key="tpl.id"
              :label="tpl.name"
              :value="tpl.id"
            />
          </el-select>
          <el-button type="primary" @click="openSaveTemplateDialog">保存定价模版</el-button>
        </div>
      </div>

      <div class="pricing-subtitle">配置标准工时</div>
      <el-form label-width="100px" class="section-form pricing-form">
        <el-row :gutter="24">
          <el-col :span="24">
            <el-form-item label="白班时长">
              <div class="period-field">
                <el-time-select
                  v-model="form.pricingConfig.dayShiftPeriod.startTime"
                  start="00:00"
                  step="00:30"
                  end="23:30"
                  placeholder="开始"
                  style="width: 120px"
                  @change="onDayShiftPeriodChange"
                />
                <span class="time-sep">至</span>
                <el-time-select
                  v-model="form.pricingConfig.dayShiftPeriod.endTime"
                  start="00:00"
                  step="00:30"
                  end="23:30"
                  placeholder="结束"
                  style="width: 120px"
                  @change="onDayShiftPeriodChange"
                />
                <span class="field-hint">{{ getPeriodDurationHours(form.pricingConfig.dayShiftPeriod) }}h</span>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="夜班时长">
              <div class="period-field">
                <el-time-select
                  v-model="form.pricingConfig.nightShiftPeriod.startTime"
                  start="00:00"
                  step="00:30"
                  end="23:30"
                  placeholder="开始"
                  style="width: 120px"
                  @change="onNightShiftPeriodChange"
                />
                <span class="time-sep">至</span>
                <el-time-select
                  v-model="form.pricingConfig.nightShiftPeriod.endTime"
                  start="00:00"
                  step="00:30"
                  end="23:30"
                  placeholder="结束"
                  style="width: 120px"
                  @change="onNightShiftPeriodChange"
                />
                <span class="field-hint">{{ getPeriodDurationHours(form.pricingConfig.nightShiftPeriod) }}h</span>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <div class="pricing-subtitle">单价配置</div>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="白班单价">
              <el-input-number v-model="form.pricingConfig.dayShiftRate" :min="0" :precision="2" /> 元/小时
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="夜班单价">
              <el-input-number v-model="form.pricingConfig.nightShiftRate" :min="0" :precision="2" /> 元/小时
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <el-table :data="pricingTableRows" border size="small" class="pricing-table">
        <el-table-column prop="label" label="项目" width="120" />
        <el-table-column label="计价方式" width="200">
          <template #default="{ row }">
            <el-radio-group
              v-model="row.config.mode"
              size="small"
              @change="onVariableModeChange(row.config)"
            >
              <el-radio
                v-for="opt in pricingValueModeOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </el-radio>
            </el-radio-group>
          </template>
        </el-table-column>
        <el-table-column label="配置值">
          <template #default="{ row }">
            <template v-if="row.config.mode === 'fixed'">
              <el-input-number
                v-model="row.config.fixedAmount"
                :min="0"
                :precision="2"
                size="small"
              />
              <span class="field-hint">元/小时</span>
            </template>
            <template v-else>
              <el-input-number
                v-model="row.config.multiplier"
                :min="0.1"
                :max="10"
                :step="0.1"
                :precision="1"
                size="small"
              />
              <span class="field-hint">倍（基于白班单价 {{ form.pricingConfig.dayShiftRate }} 元/小时）</span>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>

  <el-dialog v-model="deptPickerVisible" title="选择关联部门" width="480px">
    <el-checkbox-group v-model="selectedDeptIds">
      <el-checkbox v-for="d in store.departments" :key="d.id" :label="d.id" class="dept-check">
        {{ d.name }}
      </el-checkbox>
    </el-checkbox-group>
    <template #footer>
      <el-button @click="deptPickerVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmDepts">确定</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="saveTemplateVisible" title="保存定价模版" width="420px">
    <el-form label-width="80px">
      <el-form-item label="模版名称" required>
        <el-input v-model="templateName" placeholder="如：标准白班定价" maxlength="30" show-word-limit />
      </el-form-item>
      <p class="template-hint">将保存当前定价配置表的全部内容，包括白班/夜班时段、单价及周末/节假日/加班规则。</p>
    </el-form>
    <template #footer>
      <el-button @click="saveTemplateVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmSaveTemplate">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.form-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-top-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.top-actions {
  display: flex;
  gap: 8px;
}

.section-card {
  padding: 20px 24px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border);
}

.section-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--app-primary);
}

.section-num--1,
.section-num--2,
.section-num--3,
.section-num--4,
.section-num--5,
.section-num--6 {
  background: var(--app-primary);
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  flex: 1;
}

.section-form {
  max-width: 900px;
}

.field-hint {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
}

.time-sep {
  margin: 0 10px;
  color: #64748b;
}

.method-block {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.inline-field {
  margin-left: 16px;
  font-size: 13px;
  color: #606266;
}

.sub-block {
  margin: 0 0 16px 24px;
}

.sub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: #606266;
}

.pricing-subtitle {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin: 8px 0 12px;
}

.pricing-form {
  max-width: none;
}

.period-field {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
}

.pricing-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.template-hint {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
}

.pricing-table {
  margin-top: 8px;
}

.dept-check {
  display: flex;
  margin-bottom: 8px;
}
</style>
