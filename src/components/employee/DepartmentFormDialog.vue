<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { getDepartmentName } from '@/utils'
import { attendanceGroupTypeMap, formatShiftPeriod } from '@/constants/attendanceGroup'
import type { DepartmentNodeType, DepartmentOrgType } from '@/types'

const DRAFT_KEY = 'deptFormDraft'

const props = defineProps<{
  visible: boolean
  editingId?: string | null
  defaultParentId?: string | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: [deptId: string]
}>()

const store = useAppStore()

export interface DepartmentFormModel {
  name: string
  parentId: string | null
  orgType: DepartmentOrgType
  sort: number
  nodeType: DepartmentNodeType
  description: string
  managerEmployeeId: string | null
  attendanceGroupId: string | null
}

const emptyForm = (): DepartmentFormModel => ({
  name: '',
  parentId: props.defaultParentId ?? null,
  orgType: 'department',
  sort: 1,
  nodeType: 'branch',
  description: '',
  managerEmployeeId: null,
  attendanceGroupId: null,
})

const form = ref<DepartmentFormModel>(emptyForm())

const isEdit = computed(() => !!props.editingId)

const parentOptions = computed(() =>
  store.departments.filter((d) => d.id !== props.editingId),
)

const managerOptions = computed(() =>
  store.employees.map((emp) => ({
    value: emp.id,
    label: `星辰通信集团 - ${getDepartmentName(store.departments, emp.departmentId)} - ${emp.name}`,
  })),
)

const attendanceGroupOptions = computed(() =>
  store.attendanceGroups.filter((g) => g.status === 'enabled'),
)

const selectedAttendanceGroup = computed(() =>
  store.attendanceGroups.find((g) => g.id === form.value.attendanceGroupId),
)

const attendancePreview = computed(() => {
  const group = selectedAttendanceGroup.value
  if (!group) return null
  return {
    type: attendanceGroupTypeMap[group.attendanceType],
    period: formatShiftPeriod(group),
    monthlyLimit:
      group.minMonthlyOnlineHours && group.minMonthlyOnlineHours > 0
        ? `${group.minMonthlyOnlineHours} 小时`
        : '无限制',
    area: group.attendanceArea || group.punchLocations[0]?.name || '—',
  }
})

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    if (props.editingId) {
      const dept = store.departments.find((d) => d.id === props.editingId)
      if (!dept) return
      form.value = {
        name: dept.name,
        parentId: dept.parentId,
        orgType: dept.orgType ?? 'department',
        sort: dept.sort,
        nodeType: dept.nodeType ?? 'branch',
        description: dept.description ?? '',
        managerEmployeeId: dept.managerEmployeeId ?? null,
        attendanceGroupId: dept.attendanceGroupId ?? null,
      }
      return
    }
    form.value = emptyForm()
  },
  { immediate: true },
)

function close() {
  emit('update:visible', false)
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(form.value))
  ElMessage.success('草稿已保存')
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    form.value = { ...emptyForm(), ...JSON.parse(raw) }
    ElMessage.info('已加载草稿')
  } catch {
    /* ignore */
  }
}

function submit() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写部门名称')
    return
  }
  if (!form.value.parentId && form.value.orgType !== 'enterprise') {
    ElMessage.warning('请选择父级部门')
    return
  }
  if (!form.value.managerEmployeeId) {
    ElMessage.warning('请选择负责人')
    return
  }
  if (!form.value.attendanceGroupId) {
    ElMessage.warning('请选择关联考勤组')
    return
  }

  const payload = { ...form.value, name: form.value.name.trim() }

  try {
    if (isEdit.value && props.editingId) {
      store.updateDepartment(props.editingId, payload)
      ElMessage.success('部门已更新')
      emit('saved', props.editingId)
    } else {
      const dept = store.addDepartment(payload)
      localStorage.removeItem(DRAFT_KEY)
      ElMessage.success('部门已创建')
      emit('saved', dept.id)
    }
    close()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

defineExpose({ loadDraft })
</script>

<template>
  <el-drawer
    :model-value="visible"
    :title="isEdit ? '编辑部门' : '新增部门'"
    size="640px"
    destroy-on-close
    class="dept-form-drawer"
    @update:model-value="emit('update:visible', $event)"
  >
    <template #header>
      <div class="drawer-header">
        <div>
          <h3 class="drawer-title">{{ isEdit ? '编辑部门' : '新增部门' }}</h3>
          <p class="drawer-subtitle">填写部门基本信息并指定负责人</p>
        </div>
      </div>
    </template>

    <div class="form-section">
      <div class="section-head">
        <span class="section-dot" />
        <span>部门基本信息</span>
      </div>
      <div class="section-card">
        <el-form label-position="top" class="dept-form">
          <el-form-item label="部门名称" required>
            <el-input v-model="form.name" placeholder="请输入部门名称">
              <template #prefix><el-icon><OfficeBuilding /></el-icon></template>
            </el-input>
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="父级部门" required>
                <el-select v-model="form.parentId" placeholder="请选择父级部门" style="width: 100%">
                  <el-option
                    v-for="d in parentOptions"
                    :key="d.id"
                    :label="d.name"
                    :value="d.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="组织类型">
                <el-select v-model="form.orgType" style="width: 100%">
                  <el-option label="部门/企业" value="department" />
                  <el-option label="企业主体" value="enterprise" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="排序">
                <el-input-number v-model="form.sort" :min="1" :max="999" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="节点类型">
                <div class="node-type-group">
                  <button
                    type="button"
                    class="node-type-card"
                    :class="{ active: form.nodeType === 'branch' }"
                    @click="form.nodeType = 'branch'"
                  >
                    <strong>非叶节点</strong>
                    <span>可创建子部门</span>
                  </button>
                  <button
                    type="button"
                    class="node-type-card"
                    :class="{ active: form.nodeType === 'leaf' }"
                    @click="form.nodeType = 'leaf'"
                  >
                    <strong>叶节点</strong>
                    <span>不可创建子部门</span>
                  </button>
                </div>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="部门描述">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="3"
              placeholder="请输入部门职能与业务范围"
            />
          </el-form-item>
        </el-form>
      </div>
    </div>

    <div class="form-section">
      <div class="section-head">
        <span class="section-dot" />
        <span>负责人信息</span>
      </div>
      <div class="section-card">
        <el-form label-position="top">
          <el-form-item label="负责人姓名" required>
            <el-select
              v-model="form.managerEmployeeId"
              filterable
              placeholder="公司-部门-姓名"
              style="width: 100%"
            >
              <el-option
                v-for="opt in managerOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <div class="form-section">
      <div class="section-head">
        <span class="section-dot" />
        <span>考勤组配置</span>
      </div>
      <div class="section-card">
        <el-form label-position="top">
          <el-form-item label="关联考勤组" required>
            <el-select
              v-model="form.attendanceGroupId"
              placeholder="考勤组名称"
              style="width: 100%"
            >
              <el-option
                v-for="g in attendanceGroupOptions"
                :key="g.id"
                :label="g.name"
                :value="g.id"
              />
            </el-select>
          </el-form-item>

          <div v-if="attendancePreview" class="attendance-preview">
            <div class="preview-title">考勤规则</div>
            <div class="preview-grid">
              <div><span>考勤类型</span><strong>{{ attendancePreview.type }}</strong></div>
              <div><span>考勤时段</span><strong>{{ attendancePreview.period }}</strong></div>
              <div><span>月最低在线</span><strong>{{ attendancePreview.monthlyLimit }}</strong></div>
              <div><span>考勤区域</span><strong>{{ attendancePreview.area }}</strong></div>
            </div>
          </div>
        </el-form>
      </div>
    </div>

    <el-alert
      type="warning"
      :closable="false"
      show-icon
      title="温馨提示"
      description="带 * 号为必填项。部门创建后，可在组织架构树中拖拽调整层级顺序。"
      class="form-tip"
    />

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="close">取消</el-button>
        <el-button plain @click="saveDraft">
          <el-icon><EditPen /></el-icon>
          保存草稿
        </el-button>
        <el-button type="primary" @click="submit">
          <el-icon><CircleCheck /></el-icon>
          {{ isEdit ? '确认保存' : '确认创建' }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.drawer-header {
  padding-right: 24px;
}

.drawer-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2329;
}

.drawer-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #64748b;
}

.form-section + .form-section {
  margin-top: 18px;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.section-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5b4fdb;
}

.section-card {
  background: #f8fafc;
  border: 1px solid #e8ebf0;
  border-radius: 12px;
  padding: 16px;
}

.node-type-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
}

.node-type-card {
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 10px;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.node-type-card strong {
  display: block;
  font-size: 13px;
  color: #1f2329;
  margin-bottom: 4px;
}

.node-type-card span {
  font-size: 12px;
  color: #94a3b8;
}

.node-type-card.active {
  border-color: #5b4fdb;
  background: #f5f3ff;
  box-shadow: inset 0 0 0 1px rgba(91, 79, 219, 0.15);
}

.attendance-preview {
  background: #fff;
  border: 1px dashed #dbe1ea;
  border-radius: 10px;
  padding: 12px 14px;
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 10px;
}

.preview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
}

.preview-grid span {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 2px;
}

.preview-grid strong {
  font-size: 13px;
  color: #334155;
  font-weight: 500;
}

.form-tip {
  margin-top: 18px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
