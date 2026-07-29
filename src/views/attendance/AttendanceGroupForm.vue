<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { getDefaultScheduleRuleForSeed } from '@/services/scheduleGroup'
import { countDepartmentEmployees, generateId } from '@/utils'
import type {
  AttendanceGroup,
  AttendanceGroupShiftTemplate,
  PunchLocation,
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

const form = ref<Omit<AttendanceGroup, 'id' | 'code' | 'createdAt' | 'updatedAt'>>({
  name: '',
  description: '',
  status: 'enabled',
  attendanceType: 'shift',
  shiftTemplates: [emptyShift()],
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
  minMonthlyOnlineHours: 176,
  attendanceArea: '',
})

const deptPickerVisible = ref(false)
const selectedDeptIds = ref<string[]>([])

onMounted(() => {
  if (isEdit.value && groupId.value) {
    const source = store.attendanceGroups.find((g) => g.id === groupId.value)
    if (source) {
      form.value = JSON.parse(JSON.stringify(source))
    } else {
      ElMessage.error('考勤组不存在')
      router.replace('/attendance-groups')
    }
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
  return true
}

function save(publish = false) {
  if (!validate()) return
  try {
    if (isEdit.value && groupId.value) {
      store.updateAttendanceGroup(groupId.value, {
        ...form.value,
        status: publish ? 'enabled' : form.value.status,
      })
      ElMessage.success(publish ? '已保存并启用' : '保存成功')
    } else {
      const item = store.addAttendanceGroup({
        ...form.value,
        status: publish ? 'enabled' : form.value.status,
      })
      ElMessage.success(publish ? '已创建并启用' : '创建成功')
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

const payFormula = computed(
  () =>
    `最终薪资 = 基本时薪 × 工时 + 夜班补贴(${form.value.payRule.nightShiftTimeRange}) + 节假日补贴`,
)
</script>

<template>
  <div class="form-page">
    <div class="form-top-bar page-card">
      <div>
        <h2 class="page-title">{{ isEdit ? '编辑考勤组' : '新建考勤组' }}</h2>
        <p class="text-muted">V2.0 · 支持多班次排班</p>
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
        <span class="section-num">1</span>
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
          <el-select v-model="form.attendanceType" style="width: 240px">
            <el-option label="排班制" value="shift" />
            <el-option label="自由打卡" value="free" />
            <el-option label="不计考勤" value="none" />
          </el-select>
        </el-form-item>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="月最低在线">
              <el-input-number v-model="form.minMonthlyOnlineHours" :min="0" :max="400" />
              <span class="field-hint">小时，留空或0表示不限制</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="考勤区域">
              <el-input v-model="form.attendanceArea" placeholder="如：总部大楼" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <!-- 2 班次模版 -->
    <div v-if="form.attendanceType === 'shift'" class="section-card page-card">
      <div class="section-header">
        <span class="section-num">2</span>
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

    <!-- 3 考勤方式 -->
    <div class="section-card page-card">
      <div class="section-header">
        <span class="section-num">{{ form.attendanceType === 'shift' ? '3' : '2' }}</span>
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

    <!-- 4 合规工时红线 -->
    <div class="section-card page-card">
      <div class="section-header">
        <span class="section-num">{{ form.attendanceType === 'shift' ? '4' : '3' }}</span>
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
      </el-row>
    </div>

    <!-- 5 关联组织架构 -->
    <div class="section-card page-card">
      <div class="section-header">
        <span class="section-num">{{ form.attendanceType === 'shift' ? '5' : '4' }}</span>
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

    <!-- 6 关联计算规则 -->
    <div class="section-card page-card">
      <div class="section-header">
        <span class="section-num">{{ form.attendanceType === 'shift' ? '6' : '5' }}</span>
        <span class="section-title">关联计算规则</span>
      </div>
      <el-row :gutter="24">
        <el-col :span="8">
          <el-form-item label="基本时薪">
            <el-input-number v-model="form.payRule.baseHourlyRate" :min="1" :precision="2" /> 元/小时
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="夜班补贴">
            <el-input-number v-model="form.payRule.nightShiftSubsidy" :min="0" :precision="2" /> 元/h
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="夜班时段">
            <el-input v-model="form.payRule.nightShiftTimeRange" placeholder="22:00-06:00" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="节假日补贴">
            <el-input-number v-model="form.payRule.holidaySubsidy" :min="0" :precision="2" /> 元/天
          </el-form-item>
        </el-col>
      </el-row>
      <div class="formula-bar">{{ payFormula }}</div>
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
  background: var(--app-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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

.formula-bar {
  margin-top: 12px;
  padding: 12px 16px;
  background: #f5f3ff;
  border-radius: 8px;
  font-size: 13px;
  color: var(--app-primary);
}

.dept-check {
  display: flex;
  margin-bottom: 8px;
}
</style>
